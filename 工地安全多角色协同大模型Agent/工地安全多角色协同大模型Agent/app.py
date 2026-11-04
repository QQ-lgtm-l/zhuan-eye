import json
import shutil
import cv2
import os
import tempfile
import time
import wave

import requests
from flask import Flask, Response, request
from flask_socketio import SocketIO, emit
from ultralytics import YOLO
from utils.Fun import Fun

from yolo_detect import detector
from multi_detect import EnhancedMultiHazardDetector
from aerial_detect import AerialPileDetector
from graph_flow import safety_workflow
from state import HazardState
from agents import classify_hazard_level


_LEVEL_SEVERITY = {"Ⅳ级轻微": 0, "Ⅲ级一般": 1, "Ⅱ级较大": 2, "Ⅰ级重大": 3}


def highest_hazard_level(labels):
    """视频多标签取最高等级；无标签返回空。"""
    if not labels:
        return ""
    best = "Ⅲ级一般"
    best_score = -1
    for label in labels:
        level, _ = classify_hazard_level(label)
        score = _LEVEL_SEVERITY.get(level, 1)
        if score > best_score:
            best, best_score = level, score
    return best


def highest_level_label(levels):
    """多个已分级结果取最高等级；用于图片多隐患的顶层汇总。"""
    if not levels:
        return ""
    return max(levels, key=lambda level: _LEVEL_SEVERITY.get(level, 1))


class SafetyDetectionApp:
    def __init__(self, host='0.0.0.0', port=5000):
        self.app = Flask(__name__)
        self.socketio = SocketIO(self.app, cors_allowed_origins="*")
        self.host = host
        self.port = port
        self.fun = Fun()
        self.aerial_detector = AerialPileDetector()
        self.setup_routes()
        self.data = {}
        runs_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'runs')
        self.paths = {
            'download': os.path.join(runs_dir, 'video', 'download.mp4'),
            'output': os.path.join(runs_dir, 'video', 'output.mp4'),
            'camera_output': os.path.join(runs_dir, 'video', 'camera_output.avi'),
            'video_output': os.path.join(runs_dir, 'video', 'camera_output.avi')
        }
        self.recording = False

    def setup_routes(self):
        self.app.add_url_rule('/file_names', 'file_names', self.file_names, methods=['GET'])
        self.app.add_url_rule('/predictImgBatch', 'predictImgBatch', self.predictImgBatch, methods=['POST'])
        self.app.add_url_rule('/predictImg', 'predictImg', self.predictImg, methods=['POST'])
        self.app.add_url_rule('/predictVideo', 'predictVideo', self.predictVideo)
        self.app.add_url_rule('/predictVideoSimple', 'predictVideoSimple', self.predictVideoSimple, methods=['POST'])
        self.app.add_url_rule('/predictCamera', 'predictCamera', self.predictCamera)
        self.app.add_url_rule('/stopCamera', 'stopCamera', self.stopCamera, methods=['GET'])
        self.app.add_url_rule('/asr', 'asr', self.asr, methods=['POST'])
        self.app.add_url_rule('/tts', 'tts', self.tts, methods=['POST'])
        self.app.add_url_rule('/aerial/predict', 'aerialPredict', self.aerialPredict, methods=['POST'])

        @self.socketio.on('connect')
        def handle_connect():
            print("WebSocket connected!")
            emit('message', {'data': 'Connected to WebSocket server!'})

        @self.socketio.on('disconnect')
        def handle_disconnect():
            print("WebSocket disconnected!")

    def run(self):
        self.socketio.run(self.app, host=self.host, port=self.port, allow_unsafe_werkzeug=True)

    # ---------- 千问语音识别 / CosyVoice 语音合成 ----------
    def _dashscope_client(self):
        import dashscope
        key = os.getenv('DASHSCOPE_API_KEY', '').strip()
        if not key:
            raise RuntimeError('未配置 DASHSCOPE_API_KEY')
        base = os.getenv('DASHSCOPE_BASE_URL', 'https://dashscope.aliyuncs.com/api/v1')
        return dashscope.Client(api_key=key, base_url=base)

    def asr(self):
        """接收浏览器录音的 WAV，调用 Qwen-ASR 转成文字。"""
        tmp_path = None
        try:
            audio = request.files.get('file')
            if audio is None:
                return json.dumps({"status": 400, "message": "缺少音频文件"}, ensure_ascii=False)
            fd, tmp_path = tempfile.mkstemp(suffix='.wav')
            os.close(fd)
            audio.save(tmp_path)
            with wave.open(tmp_path, 'rb') as wav:
                sample_rate = wav.getframerate()
            client = self._dashscope_client()
            model = os.getenv('QWEN_ASR_MODEL', 'qwen-audio-3.1-asr-flash-message')
            texts = []
            events = client.audio.asr.recognize_file(
                tmp_path, model=model, format='wav', sample_rate=sample_rate
            )
            for event in events:
                payload = event.get('payload') or {}
                sentence = (payload.get('output') or {}).get('sentence') or {}
                if sentence.get('text') and not sentence.get('heartbeat') and sentence.get('sentence_end'):
                    texts.append(sentence.get('text'))
            text = ''.join(texts).strip()
            print(f"[ASR] {text}")
            return json.dumps({"status": 200, "text": text}, ensure_ascii=False)
        except Exception as e:
            print(f"[ASR] 失败: {e}")
            return json.dumps({"status": 500, "message": str(e)}, ensure_ascii=False)
        finally:
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except OSError:
                    pass

    def tts(self):
        """调用 CosyVoice 合成语音，返回可播放的音频 URL。"""
        try:
            data = request.get_json(silent=True) or {}
            text = (data.get('text') or '').strip()[:500]
            if not text:
                return json.dumps({"status": 400, "message": "文本为空"}, ensure_ascii=False)
            key = os.getenv('DASHSCOPE_API_KEY', '').strip()
            if not key:
                return json.dumps({"status": 500, "message": "未配置 DASHSCOPE_API_KEY"}, ensure_ascii=False)
            payload = {
                "model": os.getenv('QWEN_TTS_MODEL', 'cosyvoice-v3-flash'),
                "input": {
                    "text": text,
                    "voice": os.getenv('QWEN_TTS_VOICE', 'longanyang'),
                    "format": "mp3",
                    "sample_rate": 24000,
                },
            }
            response = requests.post(
                'https://dashscope.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer',
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json=payload,
                timeout=60,
            )
            result = response.json()
            audio = (result.get('output') or {}).get('audio') or {}
            if audio.get('url'):
                return json.dumps({"status": 200, "url": audio['url']}, ensure_ascii=False)
            return json.dumps({"status": 500, "message": result.get('message') or '语音合成失败'}, ensure_ascii=False)
        except Exception as e:
            print(f"[TTS] 失败: {e}")
            return json.dumps({"status": 500, "message": str(e)}, ensure_ascii=False)

    def predictImgBatch(self):
        data = request.get_json()
        self.data.clear()
        self.data.update({
            "imgFolderUrl": data['imgFolderUrl'], "username": data['username'],
            "weight": data['weight'], "conf": data['conf']
        })
        weights_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'weights')
        runs_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'runs')
        img_batch_dir = os.path.join(runs_dir, "imgBatch")
        result_batch_dir = os.path.join(runs_dir, "resultBatch")

        self.fun.download_folder(self.data["imgFolderUrl"], img_batch_dir)

        from utils import predictBatch
        predictor = predictBatch.ImagePredictor(
            weights_path=os.path.join(weights_dir, self.data["weight"]),
            input_folder=img_batch_dir,
            output_folder=result_batch_dir,
            conf=float(self.data["conf"]),
            data=self.data
        )
        batch_result = predictor.predict_batch()
        print(batch_result)

        result_list = []
        if batch_result.get('status') == 200 and batch_result.get('data'):
            for item in batch_result['data']:
                out_img_url = self.fun.upload(os.path.join(result_batch_dir, item['image']))
                result_list.append({
                    'label': json.dumps(item['labels']),
                    'confidence': json.dumps(item['confidences']),
                    'allTime': batch_result.get('allTime', ''),
                    'startTime': data.get('startTime', ''),
                    'outImg': out_img_url if out_img_url else '',
                    'Suggestion': item.get('suggestion', ''),
                    'all_detections': item.get('all_detections', [])
                })

        shutil.rmtree(img_batch_dir)
        shutil.rmtree(result_batch_dir)
        
        return {"code": 0, "message": "预测成功", "data": result_list}

    def file_names(self):
        weights_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'weights')
        weight_items = [{'value': name, 'label': name} for name in self.fun.get_file_names(weights_dir)]
        return json.dumps({'weight_items': weight_items})

    def aerialPredict(self):
        """航拍堆料检测：独立模型，只返回 pile 框，不建工单。"""
        try:
            import re
            import requests as req

            data = request.get_json() or {}
            input_img = data.get('inputImg') or data.get('image') or ''
            if not input_img:
                return json.dumps({"status": 400, "message": "缺少 inputImg", "code": -1}, ensure_ascii=False)

            match = re.search(r'/files/(.+)', input_img)
            rel_path = match.group(1) if match else input_img
            base_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'files')
            full_path = os.path.join(base_path, rel_path)

            if not os.path.exists(full_path) and input_img.startswith(('http://', 'https://')):
                resp = req.get(input_img, timeout=30)
                if resp.status_code != 200:
                    return json.dumps({"status": 400, "message": f"图片下载失败: HTTP {resp.status_code}", "code": -1}, ensure_ascii=False)
                os.makedirs(os.path.dirname(full_path), exist_ok=True)
                with open(full_path, 'wb') as fp:
                    fp.write(resp.content)

            if not os.path.exists(full_path):
                return json.dumps({"status": 400, "message": f"图片不存在: {full_path}", "code": -1}, ensure_ascii=False)

            conf = float(data.get('conf', 0.25))
            result = self.aerial_detector.predict(full_path, conf=conf, imgsz=1280)
            return json.dumps({
                "status": 200,
                "code": 0,
                "message": "航拍堆料检测完成",
                "data": result,
            }, ensure_ascii=False)
        except Exception as e:
            print(f"[AERIAL] {e}")
            return json.dumps({"status": 500, "message": f"航拍检测失败: {str(e)}", "code": -1}, ensure_ascii=False)

    def predictImg(self):
        try:
            start_time = time.time()
            
            data = request.get_json()
            print(f"=== 调试信息 ===")
            print(f"请求数据: {data}")
            
            self.data.clear()
            self.data.update({
                "username": data.get('username', 'ai_recheck'),
                "weight": data.get('weight', 'construction_safety.pt'),
                "conf": data.get('conf', '0.25'),
                "startTime": data.get('startTime', ''),
                "inputImg": data['inputImg'],
                "ai": data.get('ai', 'ai_recheck')
            })

            import re
            import requests as req
            match = re.search(r'/files/(.+)', self.data["inputImg"])
            if match:
                img_path = match.group(1)
            else:
                img_path = self.data["inputImg"]
            print(f"提取的img_path: {img_path}")

            base_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'files')
            full_path = os.path.join(base_path, img_path)
            print(f"base_path: {base_path}")
            print(f"full_path: {full_path}")
            print(f"文件是否存在: {os.path.exists(full_path)}")

            # 如果本地不存在，尝试通过HTTP下载
            if not os.path.exists(full_path):
                print(f"本地文件不存在，尝试通过HTTP下载: {self.data['inputImg']}")
                try:
                    resp = req.get(self.data["inputImg"], timeout=30)
                    if resp.status_code == 200:
                        os.makedirs(os.path.dirname(full_path), exist_ok=True)
                        with open(full_path, 'wb') as f:
                            f.write(resp.content)
                        print(f"✅ HTTP下载成功: {full_path}")
                    else:
                        print(f"❌ HTTP下载失败: status={resp.status_code}")
                        return json.dumps({
                            "status": 400,
                            "message": f"图片下载失败: HTTP {resp.status_code}",
                            "code": -1
                        }, ensure_ascii=False)
                except Exception as e:
                    print(f"❌ HTTP下载异常: {e}")
                    return json.dumps({
                        "status": 400,
                        "message": f"图片文件不存在且下载失败: {str(e)}",
                        "code": -1
                    }, ensure_ascii=False)

            runs_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'runs')
            
            self.socketio.emit('message', {'data': '正在加载YOLO模型，请稍等！'})
            
            user_conf = float(self.data["conf"])
            effective_conf = user_conf
            
            # 创建增强版双模型检测器（主模型 + COCO补充模型）
            weights_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'weights')
            primary_model = os.path.join(weights_dir, self.data["weight"])
            coco_model = os.path.join(weights_dir, 'yolov8s.pt')  # COCO预训练模型作为补充
            
            multi_detector = EnhancedMultiHazardDetector(primary_model, coco_model)
            
            # 使用低置信度 + 大图片尺寸 + TTA增强
            detect_conf = min(user_conf, 0.25)  # 最高不超过0.25
            detect_result = multi_detector.detect_image(full_path, conf_thres=detect_conf, imgsz=960)
            hazards = detect_result["hazards"]
            all_detections = detect_result["all_detections"]
            print(f"增强检测: {detect_result['total_count']} 项检测, {len(hazards)} 项隐患 (其中推断{detect_result.get('inferred_count', 0)}项)")

            # 如果仍然无隐患，再降低阈值重试
            if not hazards:
                print(f"🔄 在 {detect_conf} 下未检测到隐患，回退到 0.10 重试...")
                self.socketio.emit('message', {'data': '正在降低阈值重新检测...'})
                effective_conf = 0.10
                detect_result = multi_detector.detect_image(full_path, conf_thres=0.10, imgsz=960)
                hazards = detect_result["hazards"]
                all_detections = detect_result["all_detections"]
                if hazards:
                    print(f"✅ 回退检测到 {len(hazards)} 项隐患")

            print(f"最终检测结果: {detect_result['total_count']} 项检测, {len(hazards)} 项隐患")

            if not hazards:
                elapsed_time = time.time() - start_time
                self.data["status"] = 200
                self.data["message"] = "预测成功"
                self.data["allTime"] = f"{elapsed_time:.2f}秒"
                self.data["confidence"] = ["0.00"]
                self.data["label"] = ["未检测到安全隐患"]
                self.data["suggestion"] = "未检测到安全隐患"
                self.data["hazard_level"] = ""
                self.data["hazards"] = []
                self.data["hazard_count"] = 0
                self.data["rectify_task"] = {}
                self.data["chat_records"] = []
                self.data["ledger_data"] = {}
                self.data["all_detections"] = all_detections
                return json.dumps(self.data, ensure_ascii=False)

            # 构建所有隐患的简要描述
            hazard_labels = [h['hazard_type'] for h in hazards]
            hazard_confs = [str(h['confidence']) for h in hazards]
            self.socketio.emit('message', {'data': f'检测到 {len(hazards)} 项隐患：{"、".join(hazard_labels)}'})

            self.socketio.emit('message', {'data': '【巡检Agent】执行隐患初筛...'})
            self.socketio.emit('message', {'data': '【隐患分级Agent】执行风险分级...'})
            self.socketio.emit('message', {'data': '【派单Agent】生成整改工单...'})
            self.socketio.emit('message', {'data': '【协同沟通Agent】发起多方通知...'})
            self.socketio.emit('message', {'data': '【台账生成Agent】自动归档台账...'})

            # 对每个隐患分别运行Agent流水线，并保留每条隐患的独立结果
            all_final_states = []
            all_suggestions = []
            hazard_records = []
            for idx, h in enumerate(hazards):
                print(f"🔍 处理隐患：{h['hazard_type']} (conf={h['confidence']})")
                init_state = HazardState(hazard_raw=h)
                final_state = safety_workflow.invoke(init_state)
                all_final_states.append(final_state)

                chat_records = final_state.get('chat_records', [])
                if chat_records and len(chat_records) > 0:
                    suggestion = chat_records[0].get('msg', '')
                else:
                    suggestion = f"【{h['hazard_type']}】请立即整改。"
                all_suggestions.append(suggestion)

                task = final_state.get('rectify_task', {}) or {}
                hazard_records.append({
                    "instance_id": f"H{idx + 1:02d}",
                    "hazard_type": h['hazard_type'],
                    "level": final_state.get('hazard_level', ''),
                    "level_code": final_state.get('level_code', ''),
                    "confidence": h['confidence'],
                    "bbox": h.get('bbox', []),
                    "inferred": bool(h.get('inferred', False)),
                    "source": h.get('source', ''),
                    "duty_person": task.get('duty_person', ''),
                    "response_timeout": task.get('response_timeout', ''),
                    "rectify_timeout": task.get('rectify_timeout', ''),
                    "suggestion": suggestion,
                    "kb_id": task.get('kb_id', ''),
                    "kb_name": task.get('kb_name', ''),
                    "standard": task.get('standard', ''),
                    "clause_no": task.get('clause_no', ''),
                    "clause_ids": task.get('clause_ids', []),
                    "rectify_measure": task.get('rectify_measure', ''),
                })
                print(f"🔍 Agent流水线完成: {h['hazard_type']}, hazard_level={final_state.get('hazard_level', 'N/A')}")

            # 顶层字段取最高等级的那条，兼容旧接口；新增 hazards[] 给多目标消费
            level_order = {"Ⅰ级重大": 4, "Ⅱ级较大": 3, "Ⅲ级一般": 2, "Ⅳ级轻微": 1}
            final_state = max(
                all_final_states,
                key=lambda s: level_order.get(s.get("hazard_level", ""), 0),
            ) if all_final_states else {}
            self.data["hazards"] = hazard_records
            self.data["hazard_count"] = len(hazard_records)
            self.data["kb_ids"] = [h.get("kb_id") for h in hazard_records if h.get("kb_id")]

            # ========== 绘制标注图（含推断的隐患框） ==========
            import cv2
            import numpy as np
            img = cv2.imread(full_path)
            if img is None:
                img = cv2.imdecode(np.fromfile(full_path, dtype=np.uint8), cv2.IMREAD_COLOR)
            
            # 颜色方案: 隐患=红色, 正常=绿色, 中性=蓝色, 推断=橙色
            colors = {
                'hazard': (0, 0, 255),      # 红
                'normal': (0, 255, 0),      # 绿
                'neutral': (255, 0, 0),     # 蓝
                'inferred': (0, 165, 255),  # 橙
            }
            
            for d in all_detections:
                bbox = d.get('bbox')
                if not bbox or len(bbox) != 4:
                    continue
                x1, y1, x2, y2 = [int(v) for v in bbox]
                
                # 选择颜色
                if d.get('inferred'):
                    color = colors['inferred']
                elif d['is_hazard']:
                    color = colors['hazard']
                elif d['category'] == 'normal':
                    color = colors['normal']
                else:
                    color = colors['neutral']
                
                # 画框
                cv2.rectangle(img, (x1, y1), (x2, y2), color, 2)
                
                # 标签文字
                label = f"{d['hazard_type']} {d['confidence']:.2f}"
                if d.get('inferred'):
                    label = f"🔍推断: {label}"
                
                # 标签背景
                (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
                cv2.rectangle(img, (x1, y1 - th - 6), (x1 + tw, y1), color, -1)
                cv2.putText(img, label, (x1, y1 - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
            
            result_path = os.path.join(runs_dir, 'result.jpg')
            cv2.imwrite(result_path, img)

            uploadedUrl = self.fun.upload(result_path)
            print(f"上传结果: {uploadedUrl}")

            elapsed_time = time.time() - start_time
            
            self.data["status"] = 200
            self.data["message"] = "预测成功"
            self.data["outImg"] = uploadedUrl if uploadedUrl else self.data["inputImg"]
            self.data["allTime"] = f"{elapsed_time:.2f}秒"
            self.data["confidence"] = hazard_confs
            self.data["label"] = hazard_labels
            
            # 顶层取最高等级；详情仍保留在 hazards[] 每条记录里
            level_values = [fs.get('hazard_level', '') for fs in all_final_states]
            self.data["hazard_level"] = highest_level_label(level_values) or final_state.get('hazard_level', '')
            self.data["rectify_task"] = final_state.get('rectify_task', {})
            self.data["chat_records"] = final_state.get('chat_records', [])
            self.data["ledger_data"] = final_state.get('ledger_data', {})
            self.data["all_detections"] = all_detections
            
            # 拼接所有隐患的建议
            if all_suggestions:
                if len(hazards) > 1:
                    multi_suggestion = f"检测到 {len(hazards)} 项隐患：{'、'.join(hazard_labels)}。\n\n"
                    multi_suggestion += "\n\n---\n\n".join(all_suggestions)
                    self.data["suggestion"] = multi_suggestion
                else:
                    self.data["suggestion"] = all_suggestions[0]
            else:
                self.data["suggestion"] = ""

        except Exception as e:
            import traceback
            print(f"预测过程中发生异常: {e}")
            print(traceback.format_exc())
            self.data["status"] = 400
            self.data["message"] = f"预测异常: {str(e)}"

        return json.dumps(self.data, ensure_ascii=False)

    def predictVideo(self):
        self.data.clear()
        self.data.update({
            "username": request.args.get('username'), "weight": request.args.get('weight'),
            "conf": request.args.get('conf'), "startTime": request.args.get('startTime'),
            "inputVideo": request.args.get('inputVideo')
        })
        self.fun.download(self.data["inputVideo"], self.paths['download'])
        cap = cv2.VideoCapture(self.paths['download'])
        if not cap.isOpened():
            raise ValueError("无法打开视频文件")
        fps = int(cap.get(cv2.CAP_PROP_FPS))
        print(f"视频FPS: {fps}")

        video_writer = cv2.VideoWriter(
            self.paths['video_output'],
            cv2.VideoWriter_fourcc(*'XVID'),
            fps,
            (640, 480)
        )

        # ========== 使用与图像检测相同的增强版双模型检测器 ==========
        weights_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'weights')
        primary_model = os.path.join(weights_dir, self.data["weight"])
        coco_model = os.path.join(weights_dir, 'yolov8s.pt')
        multi_detector = EnhancedMultiHazardDetector(primary_model, coco_model)

        user_conf = float(self.data['conf'])
        detect_conf = min(user_conf, 0.25)

        # 累积所有帧的隐患统计
        hazard_counts = {}
        max_confidences = {}
        frame_count = 0
        sample_interval = max(1, fps // 3)  # 每秒采样约3帧用于增强检测

        self.socketio.emit('message', {'data': '正在使用双模型增强检测视频...'})

        def generate():
            nonlocal frame_count
            try:
                while cap.isOpened():
                    ret, frame = cap.read()
                    if not ret:
                        break
                    frame = cv2.resize(frame, (640, 480))
                    frame_count += 1

                    # 增强检测：双模型 + 后处理推断（采样帧）
                    if frame_count % sample_interval == 0 or frame_count == 1:
                        detect_result = multi_detector.detect_frame(frame, conf_thres=detect_conf, imgsz=640)
                        hazards = detect_result["hazards"]
                        all_detections = detect_result["all_detections"]

                        for h in hazards:
                            ht = h['hazard_type']
                            if ht in hazard_counts:
                                hazard_counts[ht] += 1
                                if h['confidence'] > max_confidences[ht]:
                                    max_confidences[ht] = h['confidence']
                            else:
                                hazard_counts[ht] = 1
                                max_confidences[ht] = h['confidence']

                        # 绘制所有检测结果（隐患+正常+中性+推断），与图像检测标注一致
                        frame = multi_detector.draw_detections(frame, all_detections)
                    else:
                        # 非采样帧：用主模型快速检测并绘制
                        results = multi_detector.primary_model.predict(
                            source=frame, conf=detect_conf, imgsz=640, show=False, verbose=False
                        )
                        if results[0].boxes is not None and len(results[0].boxes) > 0:
                            for box in results[0].boxes:
                                cls_id = int(box.cls[0])
                                conf_val = float(box.conf[0])
                                class_name = multi_detector.primary_names[cls_id]
                                category, hazard_type = multi_detector._classify(class_name)

                                if category == 'hazard':
                                    x1, y1, x2, y2 = [int(v) for v in box.xyxy[0].tolist()]
                                    cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 0, 255), 2)
                                    label_text = f"{hazard_type} {conf_val:.2f}"
                                    (tw, th), _ = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
                                    cv2.rectangle(frame, (x1, y1 - th - 6), (x1 + tw, y1), (0, 0, 255), -1)
                                    cv2.putText(frame, label_text, (x1, y1 - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

                                    if hazard_type in hazard_counts:
                                        hazard_counts[hazard_type] += 1
                                        if conf_val > max_confidences[hazard_type]:
                                            max_confidences[hazard_type] = conf_val
                                    else:
                                        hazard_counts[hazard_type] = 1
                                        max_confidences[hazard_type] = conf_val

                    video_writer.write(frame)
                    _, jpeg = cv2.imencode('.jpg', frame)
                    yield b'--frame\r\n' b'Content-Type: image/jpeg\r\n\r\n' + jpeg.tobytes() + b'\r\n'
            finally:
                self.fun.cleanup_resources(cap, video_writer)
                self.socketio.emit('message', {'data': '处理完成，正在保存！'})

                labels = list(hazard_counts.keys())
                confidences = [f"{max_confidences[label]:.2f}" for label in labels]

                if not labels:
                    labels = ["未检测到安全隐患"]
                    confidences = ["0.00"]
                    hazard_level = ""
                    suggestion_text = "未检测到安全隐患，请继续保持。"
                else:
                    # 四级隐患分级：多标签取最高级
                    hazard_level = highest_hazard_level(labels)

                    # ========== 调用LangGraph多Agent流水线生成整改建议（与图像检测一致） ==========
                    self.socketio.emit('message', {'data': f'检测到 {len(labels)} 项隐患，正在调用Agent生成整改建议...'})
                    self.socketio.emit('message', {'data': '【巡检Agent】执行隐患初筛...'})
                    self.socketio.emit('message', {'data': '【隐患分级Agent】执行风险分级...'})
                    self.socketio.emit('message', {'data': '【派单Agent】生成整改工单...'})
                    self.socketio.emit('message', {'data': '【协同沟通Agent】发起多方通知...'})
                    self.socketio.emit('message', {'data': '【台账生成Agent】自动归档台账...'})

                    all_suggestions = []
                    for label in labels:
                        try:
                            hazard_obj = {
                                'hazard_type': label,
                                'confidence': max_confidences[label],
                                'bbox': [0, 0, 0, 0],
                                'time': time.strftime("%Y-%m-%d %H:%M:%S"),
                                'camera_id': "视频检测",
                            }
                            init_state = HazardState(hazard_raw=hazard_obj)
                            final_state = safety_workflow.invoke(init_state)
                            chat_records = final_state.get('chat_records', [])
                            if chat_records and len(chat_records) > 0:
                                all_suggestions.append(chat_records[0].get('msg', ''))
                            else:
                                all_suggestions.append(f"【{label}】请立即整改，加强现场安全管理。")
                            print(f"🔍 视频检测Agent流水线完成: {label}, hazard_level={final_state.get('hazard_level', 'N/A')}")
                        except Exception as agent_err:
                            print(f"⚠️ Agent流水线异常({label}): {agent_err}")
                            all_suggestions.append(f"【{label}】请立即整改，加强现场安全管理。")

                    # 拼接所有隐患建议
                    if len(all_suggestions) > 1:
                        suggestion_text = f"检测到 {len(all_suggestions)} 项隐患：{'、'.join(labels)}。\n\n" + "\n\n---\n\n".join(all_suggestions)
                    else:
                        suggestion_text = all_suggestions[0]

                self.data["label"] = json.dumps(labels, ensure_ascii=False)
                self.data["confidence"] = json.dumps(confidences, ensure_ascii=False)
                self.data["hazard_level"] = hazard_level
                self.data["suggestion"] = suggestion_text

                for progress in self.fun.convert_avi_to_mp4(self.paths['video_output']):
                    self.socketio.emit('progress', {'data': progress})
                uploadedUrl = self.fun.upload(self.paths['output'])
                self.data["outVideo"] = uploadedUrl

                inputVideoUrl = self.fun.upload(self.paths['download'])
                self.data["inputVideo"] = inputVideoUrl if inputVideoUrl else self.data["inputVideo"]

                self.data["status"] = 200
                self.data["message"] = "预测成功"

                print(f"视频检测结果: labels={labels}, confidences={confidences}")

                self.fun.save_data(json.dumps(self.data, ensure_ascii=False), 'http://localhost:9999/videoRecords')
                self.fun.cleanup_files([self.paths['download'], self.paths['output'], self.paths['video_output']])

        return Response(generate(), mimetype='multipart/x-mixed-replace; boundary=frame')

    def predictVideoSimple(self):
        self.data.clear()
        data = request.get_json()
        self.data.update({
            "username": data.get('username'), "weight": data.get('weight'),
            "conf": data.get('conf'), "startTime": data.get('startTime'),
            "inputVideo": data.get('inputVideo')
        })
        try:
            self.fun.download(self.data["inputVideo"], self.paths['download'])
            cap = cv2.VideoCapture(self.paths['download'])
            if not cap.isOpened():
                self.data["status"] = 400
                self.data["message"] = "无法打开视频文件"
                return json.dumps(self.data, ensure_ascii=False)

            fps = int(cap.get(cv2.CAP_PROP_FPS))
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            
            video_writer = cv2.VideoWriter(
                self.paths['video_output'],
                cv2.VideoWriter_fourcc(*'XVID'),
                fps,
                (640, 480)
            )

            # ========== 使用与图像检测相同的增强版双模型检测器 ==========
            weights_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'weights')
            primary_model = os.path.join(weights_dir, self.data["weight"])
            coco_model = os.path.join(weights_dir, 'yolov8s.pt')
            
            multi_detector = EnhancedMultiHazardDetector(primary_model, coco_model)
            
            user_conf = float(self.data['conf'])
            detect_conf = min(user_conf, 0.25)

            # 累积所有帧的隐患统计
            hazard_counts = {}
            max_confidences = {}
            frame_count = 0
            sample_interval = max(1, fps // 3)  # 每秒采样约3帧用于增强检测

            self.socketio.emit('message', {'data': '正在使用双模型增强检测视频...'})

            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break
                frame = cv2.resize(frame, (640, 480))
                frame_count += 1

                # 增强检测：双模型 + 后处理推断（采样帧）
                if frame_count % sample_interval == 0 or frame_count == 1:
                    detect_result = multi_detector.detect_frame(frame, conf_thres=detect_conf, imgsz=640)
                    hazards = detect_result["hazards"]
                    all_detections = detect_result["all_detections"]

                    for h in hazards:
                        ht = h['hazard_type']
                        if ht in hazard_counts:
                            hazard_counts[ht] += 1
                            if h['confidence'] > max_confidences[ht]:
                                max_confidences[ht] = h['confidence']
                        else:
                            hazard_counts[ht] = 1
                            max_confidences[ht] = h['confidence']

                    # 绘制所有检测结果（隐患+正常+中性+推断）
                    frame = multi_detector.draw_detections(frame, all_detections)
                else:
                    # 非采样帧：用主模型快速检测并绘制
                    results = multi_detector.primary_model.predict(
                        source=frame, conf=detect_conf, imgsz=640, show=False, verbose=False
                    )
                    if results[0].boxes is not None and len(results[0].boxes) > 0:
                        for box in results[0].boxes:
                            cls_id = int(box.cls[0])
                            conf_val = float(box.conf[0])
                            class_name = multi_detector.primary_names[cls_id]
                            category, hazard_type = multi_detector._classify(class_name)

                            if category == 'hazard':
                                x1, y1, x2, y2 = [int(v) for v in box.xyxy[0].tolist()]
                                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 0, 255), 2)
                                label_text = f"{hazard_type} {conf_val:.2f}"
                                (tw, th), _ = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
                                cv2.rectangle(frame, (x1, y1 - th - 6), (x1 + tw, y1), (0, 0, 255), -1)
                                cv2.putText(frame, label_text, (x1, y1 - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

                                if hazard_type in hazard_counts:
                                    hazard_counts[hazard_type] += 1
                                    if conf_val > max_confidences[hazard_type]:
                                        max_confidences[hazard_type] = conf_val
                                else:
                                    hazard_counts[hazard_type] = 1
                                    max_confidences[hazard_type] = conf_val

                video_writer.write(frame)

            self.fun.cleanup_resources(cap, video_writer)

            labels = list(hazard_counts.keys())
            confidences = [f"{max_confidences[label]:.2f}" for label in labels]

            if not labels:
                labels = ["未检测到安全隐患"]
                confidences = ["0.00"]
                hazard_level = ""
                suggestion_text = "未检测到安全隐患，请继续保持。"
            else:
                # 四级隐患分级：多标签取最高级
                hazard_level = highest_hazard_level(labels)

                # ========== 调用LangGraph多Agent流水线生成整改建议（与图像检测一致） ==========
                self.socketio.emit('message', {'data': f'检测到 {len(labels)} 项隐患，正在调用Agent生成整改建议...'})
                self.socketio.emit('message', {'data': '【巡检Agent】执行隐患初筛...'})
                self.socketio.emit('message', {'data': '【隐患分级Agent】执行风险分级...'})
                self.socketio.emit('message', {'data': '【派单Agent】生成整改工单...'})
                self.socketio.emit('message', {'data': '【协同沟通Agent】发起多方通知...'})
                self.socketio.emit('message', {'data': '【台账生成Agent】自动归档台账...'})

                all_suggestions = []
                for label in labels:
                    try:
                        hazard_obj = {
                            'hazard_type': label,
                            'confidence': max_confidences[label],
                            'bbox': [0, 0, 0, 0],
                            'time': time.strftime("%Y-%m-%d %H:%M:%S"),
                            'camera_id': "视频检测",
                        }
                        init_state = HazardState(hazard_raw=hazard_obj)
                        final_state = safety_workflow.invoke(init_state)
                        chat_records = final_state.get('chat_records', [])
                        if chat_records and len(chat_records) > 0:
                            all_suggestions.append(chat_records[0].get('msg', ''))
                        else:
                            all_suggestions.append(f"【{label}】请立即整改，加强现场安全管理。")
                        print(f"🔍 视频检测Agent流水线完成: {label}, hazard_level={final_state.get('hazard_level', 'N/A')}")
                    except Exception as agent_err:
                        print(f"⚠️ Agent流水线异常({label}): {agent_err}")
                        all_suggestions.append(f"【{label}】请立即整改，加强现场安全管理。")

                # 拼接所有隐患建议
                if len(all_suggestions) > 1:
                    suggestion_text = f"检测到 {len(all_suggestions)} 项隐患：{'、'.join(labels)}。\n\n" + "\n\n---\n\n".join(all_suggestions)
                else:
                    suggestion_text = all_suggestions[0]

            self.data["label"] = json.dumps(labels, ensure_ascii=False)
            self.data["confidence"] = json.dumps(confidences, ensure_ascii=False)
            self.data["hazard_level"] = hazard_level
            self.data["suggestion"] = suggestion_text

            for progress in self.fun.convert_avi_to_mp4(self.paths['video_output']):
                pass
            uploadedUrl = self.fun.upload(self.paths['output'])
            self.data["outVideo"] = uploadedUrl
            
            inputVideoUrl = self.fun.upload(self.paths['download'])
            self.data["inputVideo"] = inputVideoUrl if inputVideoUrl else self.data["inputVideo"]
            
            self.data["status"] = 200
            self.data["message"] = "预测成功"

            self.fun.save_data(json.dumps(self.data, ensure_ascii=False), 'http://127.0.0.1:9999/videoRecords')
            self.fun.cleanup_files([self.paths['download'], self.paths['output'], self.paths['video_output']])

            return json.dumps(self.data, ensure_ascii=False)

        except Exception as e:
            self.data["status"] = 400
            self.data["message"] = f"预测异常: {str(e)}"
            return json.dumps(self.data, ensure_ascii=False)

    def predictCamera(self):
        self.data.clear()
        self.data.update({
            "username": request.args.get('username'), "weight": request.args.get('weight'),
            "conf": request.args.get('conf'), "startTime": request.args.get('startTime')
        })
        self.socketio.emit('message', {'data': '正在加载，请稍等！'})
        model = YOLO(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'weights', self.data["weight"]))
        cap = cv2.VideoCapture(0)
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        video_writer = cv2.VideoWriter(self.paths['camera_output'], cv2.VideoWriter_fourcc(*'XVID'), 20, (640, 480))
        self.recording = True

        def generate():
            try:
                while self.recording:
                    ret, frame = cap.read()
                    if not ret:
                        break
                    results = model.predict(source=frame, imgsz=640, conf=float(self.data['conf']), show=False)
                    processed_frame = results[0].plot()
                    if self.recording and video_writer:
                        video_writer.write(processed_frame)
                    _, jpeg = cv2.imencode('.jpg', processed_frame)
                    yield b'--frame\r\n' b'Content-Type: image/jpeg\r\n\r\n' + jpeg.tobytes() + b'\r\n'
            finally:
                self.fun.cleanup_resources(cap, video_writer)
                self.socketio.emit('message', {'data': '处理完成，正在保存！'})
                for progress in self.fun.convert_avi_to_mp4(self.paths['camera_output']):
                    self.socketio.emit('progress', {'data': progress})
                uploadedUrl = self.fun.upload(self.paths['output'])
                self.data["outVideo"] = uploadedUrl
                self.fun.save_data(json.dumps(self.data), 'http://localhost:9999/cameraRecords')
                self.fun.cleanup_files([self.paths['download'], self.paths['output'], self.paths['camera_output']])

        return Response(generate(), mimetype='multipart/x-mixed-replace; boundary=frame')

    def stopCamera(self):
        self.recording = False
        return json.dumps({"status": 200, "message": "预测成功", "code": 0})


if __name__ == '__main__':
    safety_app = SafetyDetectionApp()
    safety_app.run()