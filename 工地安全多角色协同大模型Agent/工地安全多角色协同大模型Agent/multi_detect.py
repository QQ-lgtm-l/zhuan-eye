"""
增强版多隐患检测器
- 双模型集成: construction_safety.pt + yolov8s.pt(COCO)
- TTA增强 + 大尺寸推理
- 后处理推断: person无hardhat重叠 → 未佩戴安全帽
"""
import torch
_orig_torch_load = torch.load
def _patched_load(*args, **kwargs):
    if "weights_only" not in kwargs:
        kwargs["weights_only"] = False
    return _orig_torch_load(*args, **kwargs)
torch.load = _patched_load

from ultralytics import YOLO
import os
import time
import numpy as np

class EnhancedMultiHazardDetector:
    """增强版多隐患检测器，支持双模型集成和后处理推断"""

    # 隐患类别映射（涵盖所有模型）
    HAZARD_MAP = {
        'no-hardhat': '未佩戴安全帽', 'no_hardhat': '未佩戴安全帽', 'no_helmet': '未佩戴安全帽',
        'no_safety_vest': '未穿反光背心', 'no_vest': '未穿反光背心',
        'no_mask': '未佩戴口罩',
        'no_gloves': '未佩戴手套',
        'no_boots': '未穿防滑安全鞋', 'no_safety_shoes': '未穿防滑安全鞋',
        'no_goggle': '未佩戴护目镜', 'no_goggles': '未佩戴护目镜',
        'dump_truck': '车辆违规停放', 'truck': '车辆违规停放', 'mini_van': '车辆违规停放',
        'excavator': '机械违规作业', 'wheel_loader': '机械违规作业',
        'bus': '车辆违规停放', 'car': '车辆违规停放',
    }

    # 正常状态类别
    NORMAL_CLASSES = {
        'hardhat', 'helmet', 'safety_vest', 'vest', 'mask', 'gloves',
        'safety_shoes', 'boots', 'goggle', 'goggles',
        'barricade', 'safety_net', 'dumpster',
    }

    # 中性类别
    NEUTRAL_CLASSES = {'person', 'none'}

    def __init__(self, primary_model_path: str, coco_model_path: str = None):
        """初始化双模型"""
        self.primary_model = YOLO(primary_model_path)
        self.primary_names = self.primary_model.names

        # COCO补充模型（用于检测person）
        self.coco_model = None
        self.coco_names = {}
        if coco_model_path and os.path.exists(coco_model_path):
            self.coco_model = YOLO(coco_model_path)
            self.coco_names = self.coco_model.names
            print(f"✅ 双模型集成: 主模型({len(self.primary_names)}类) + COCO模型({len(self.coco_names)}类)")
        else:
            print(f"⚠️ 仅使用主模型: {len(self.primary_names)}类")

    def _classify(self, class_name):
        """分类检测目标: hazard/normal/neutral/unknown"""
        name_lower = class_name.lower()
        name_norm = name_lower.replace('-', '_')

        if name_norm in self.HAZARD_MAP:
            return 'hazard', self.HAZARD_MAP[name_norm]
        elif name_norm in self.NORMAL_CLASSES or name_lower in self.NORMAL_CLASSES:
            return 'normal', class_name
        elif name_norm in self.NEUTRAL_CLASSES or name_lower in self.NEUTRAL_CLASSES:
            return 'neutral', class_name
        else:
            return 'unknown', class_name

    def _iou(self, box1, box2):
        """计算两个bbox的IoU"""
        x1 = max(box1[0], box2[0])
        y1 = max(box1[1], box2[1])
        x2 = min(box1[2], box2[2])
        y2 = min(box1[3], box2[3])
        if x2 <= x1 or y2 <= y1:
            return 0.0
        inter = (x2 - x1) * (y2 - y1)
        area1 = (box1[2] - box1[0]) * (box1[3] - box1[1])
        area2 = (box2[2] - box2[0]) * (box2[3] - box2[1])
        union = area1 + area2 - inter
        return inter / union if union > 0 else 0.0

    def _get_head_region(self, person_bbox):
        """根据person bbox推断头部区域（上1/4）"""
        x1, y1, x2, y2 = person_bbox
        head_h = (y2 - y1) * 0.25
        return [x1, y1, x2, y1 + head_h]

    def _get_upper_body_region(self, person_bbox):
        """根据person bbox推断上半身区域（上1/2）"""
        x1, y1, x2, y2 = person_bbox
        mid_y = y1 + (y2 - y1) * 0.5
        return [x1, y1, x2, mid_y]

    def _infer_missing_ppe(self, detections):
        """
        后处理推断：对每个person，检查是否有对应的防护装备
        - 头部区域无hardhat → 未佩戴安全帽
        - 上半身无safety_vest → 未穿反光背心
        """
        inferred_hazards = []
        persons = [d for d in detections if d['class_name'].lower() in ('person', 'none')]
        hardhats = [d for d in detections if d['class_name'].lower().replace('-', '_') in ('hardhat', 'helmet')]
        vests = [d for d in detections if d['class_name'].lower().replace('-', '_') in ('safety_vest', 'vest')]

        for person in persons:
            person_bbox = person['bbox']
            head_region = self._get_head_region(person_bbox)
            upper_body = self._get_upper_body_region(person_bbox)

            # 检查头部是否有hardhat
            has_helmet = False
            for hat in hardhats:
                if self._iou(head_region, hat['bbox']) > 0.1:
                    has_helmet = True
                    break

            if not has_helmet:
                # 推断为未佩戴安全帽
                inferred_hazards.append({
                    'class_id': -1,
                    'class_name': 'no-hardhat(inferred)',
                    'class_name_normalized': 'no_hardhat',
                    'confidence': round(person['confidence'] * 0.7, 2),  # 推断置信度降低
                    'category': 'hazard',
                    'hazard_type': '未佩戴安全帽',
                    'is_hazard': True,
                    'bbox': [round(x, 1) for x in person_bbox],
                    'time': person['time'],
                    'camera_id': person['camera_id'],
                    'inferred': True
                })
                print(f"   🔍 推断: person({person['confidence']:.2f}) 头部无hardhat → 未佩戴安全帽")

            # 检查上半身是否有safety_vest
            has_vest = False
            for vest in vests:
                if self._iou(upper_body, vest['bbox']) > 0.1:
                    has_vest = True
                    break

            if not has_vest:
                inferred_hazards.append({
                    'class_id': -1,
                    'class_name': 'no_safety_vest(inferred)',
                    'class_name_normalized': 'no_safety_vest',
                    'confidence': round(person['confidence'] * 0.6, 2),
                    'category': 'hazard',
                    'hazard_type': '未穿反光背心',
                    'is_hazard': True,
                    'bbox': [round(x, 1) for x in person_bbox],
                    'time': person['time'],
                    'camera_id': person['camera_id'],
                    'inferred': True
                })
                print(f"   🔍 推断: person({person['confidence']:.2f}) 上半身无vest → 未穿反光背心")

        return inferred_hazards

    def _containment(self, inner, outer):
        """inner 框被 outer 框包含的比例（交集 / inner 面积）"""
        x1 = max(inner[0], outer[0])
        y1 = max(inner[1], outer[1])
        x2 = min(inner[2], outer[2])
        y2 = min(inner[3], outer[3])
        if x2 <= x1 or y2 <= y1:
            return 0.0
        inter = (x2 - x1) * (y2 - y1)
        inner_area = (inner[2] - inner[0]) * (inner[3] - inner[1])
        return inter / inner_area if inner_area > 0 else 0.0

    def _deduplicate(self, detections):
        """
        实例级去重：只压掉同一个目标的重复框，不合并不同目标。

        - 同一 (category, hazard_type) 下，IoU 高或小框被大框高度包含 → 视为重复；
        - 5 个不同人的“未佩戴安全帽”框彼此不重叠 → 保留 5 条；
        - 同一人被模型直检 + 后处理推断重复 → 只保留置信度高的一条。
        """
        # 人物框用于把“头部/上身小框”归到同一个人，避免同一人重复
        persons = [
            d for d in detections
            if d.get('class_name', '').lower() in ('person', 'none')
        ]

        def find_person(bbox):
            best_id, best_ratio = None, 0.0
            for idx, person in enumerate(persons):
                ratio = self._containment(bbox, person['bbox'])
                if ratio > best_ratio:
                    best_id, best_ratio = idx, ratio
            return best_id if best_ratio >= 0.55 else None

        # 按 (category, hazard_type) 分组
        groups = {}
        for d in detections:
            key = (d['category'], d['hazard_type'])
            if key not in groups:
                groups[key] = []
            groups[key].append(d)

        deduped = []
        for key, items in groups.items():
            items.sort(key=lambda x: x['confidence'], reverse=True)
            kept = []
            for item in items:
                item_person = find_person(item['bbox'])
                duplicate = False
                for exist in kept:
                    # 同一人物 + 同一隐患类型：直检框和推断框只留一个
                    if item_person is not None and item_person == exist.get('_person_id'):
                        duplicate = True
                    else:
                        iou = self._iou(item['bbox'], exist['bbox'])
                        containment = max(
                            self._containment(item['bbox'], exist['bbox']),
                            self._containment(exist['bbox'], item['bbox']),
                        )
                        # 隐患框：同一目标 IoU 或包含度达到阈值即重复
                        if key[0] == 'hazard':
                            is_dup = iou > 0.45 or containment > 0.65
                        else:
                            is_dup = iou > 0.55 or containment > 0.85
                        duplicate = is_dup
                    if duplicate:
                        exist['suppressed_count'] = exist.get('suppressed_count', 0) + 1
                        break
                if not duplicate:
                    node = item.copy()
                    node['merge_count'] = 1
                    node['suppressed_count'] = 0
                    node['_person_id'] = item_person
                    kept.append(node)
            deduped.extend(kept)

        # 内部字段不返回给前端
        for node in deduped:
            node.pop('_person_id', None)

        # 按置信度排序
        deduped.sort(key=lambda x: x['confidence'], reverse=True)
        return deduped

    def detect_image(self, img_path: str, conf_thres=0.25, imgsz=640):
        """
        增强检测：双模型 + TTA + 后处理推断
        """
        all_detections = []

        # ========== 1. 主模型检测（低置信度 + TTA增强） ==========
        try:
            results = self.primary_model(
                img_path, conf=conf_thres, imgsz=imgsz, augment=True, verbose=False
            )[0]
        except Exception as e:
            print(f"⚠️ 主模型检测失败: {e}")
            results = None

        if results is not None and results.boxes is not None and len(results.boxes) > 0:
            for box in results.boxes:
                cls_id = int(box.cls[0])
                conf_val = float(box.conf[0])
                class_name = self.primary_names[cls_id] if cls_id < len(self.primary_names) else f"class_{cls_id}"
                category, hazard_type = self._classify(class_name)

                all_detections.append({
                    'class_id': cls_id,
                    'class_name': class_name,
                    'class_name_normalized': class_name.lower().replace('-', '_'),
                    'confidence': round(conf_val, 2),
                    'category': category,
                    'hazard_type': hazard_type,
                    'is_hazard': category == 'hazard',
                    'bbox': [round(x, 1) for x in box.xyxy[0].tolist()],
                    'time': time.strftime("%Y-%m-%d %H:%M:%S"),
                    'camera_id': "现场默认摄像头",
                    'source': 'primary',
                    'inferred': False
                })

        # ========== 2. COCO补充模型检测person ==========
        person_detected_by_primary = any(d['class_name'].lower() in ('person', 'none') for d in all_detections)

        if self.coco_model is not None:
            try:
                coco_results = self.coco_model(
                    img_path, conf=max(conf_thres, 0.3), imgsz=imgsz, verbose=False
                )[0]

                if coco_results.boxes is not None and len(coco_results.boxes) > 0:
                    for box in coco_results.boxes:
                        cls_id = int(box.cls[0])
                        conf_val = float(box.conf[0])
                        class_name = self.coco_names.get(cls_id, f"class_{cls_id}")

                        # 只取person，其他COCO类别忽略（避免误检）
                        if class_name.lower() != 'person':
                            continue

                        # 检查是否与主模型的person重复
                        new_bbox = box.xyxy[0].tolist()
                        is_duplicate = False
                        for d in all_detections:
                            if d['class_name'].lower() in ('person', 'none'):
                                if self._iou(new_bbox, d['bbox']) > 0.5:
                                    is_duplicate = True
                                    break

                        if not is_duplicate:
                            all_detections.append({
                                'class_id': cls_id,
                                'class_name': 'person',
                                'class_name_normalized': 'person',
                                'confidence': round(conf_val, 2),
                                'category': 'neutral',
                                'hazard_type': 'person',
                                'is_hazard': False,
                                'bbox': [round(x, 1) for x in new_bbox],
                                'time': time.strftime("%Y-%m-%d %H:%M:%S"),
                                'camera_id': "现场默认摄像头",
                                'source': 'coco',
                                'inferred': False
                            })
            except Exception as e:
                print(f"⚠️ COCO模型检测失败: {e}")

        # ========== 3. 后处理推断：person无防护装备 → 隐患 ==========
        inferred = self._infer_missing_ppe(all_detections)
        all_detections.extend(inferred)

        # ========== 4. 去重：相同隐患类型合并，保留最高置信度 ==========
        deduped = self._deduplicate(all_detections)
        hazards = [d for d in deduped if d['is_hazard']]
        all_detections = deduped

        # 日志
        print(f"🔍 增强检测结果 (去重后):")
        for d in all_detections:
            icon = "⚠️" if d['is_hazard'] else ("✅" if d['category'] == 'normal' else "➖")
            src = d.get('source', '?')[0].upper()
            inf = "🔍" if d.get('inferred') else ""
            count = f" x{d['merge_count']}" if d.get('merge_count', 1) > 1 else ""
            print(f"   {icon} [{src}{inf}] {d['class_name']} conf={d['confidence']:.2f} → {d['hazard_type']}{count}")

        print(f"📋 汇总: 隐患 {len(hazards)} 项, "
              f"正常 {len([d for d in all_detections if d['category']=='normal'])} 项, "
              f"中性 {len([d for d in all_detections if d['category']=='neutral'])} 项")

        return {
            "all_detections": all_detections,
            "hazards": hazards,
            "total_count": len(all_detections),
            "hazard_count": len(hazards),
            "inferred_count": len(inferred)
        }

    def detect_frame(self, frame, conf_thres=0.25, imgsz=640):
        """
        视频帧检测：双模型 + 后处理推断（不用TTA，提升速度）
        参数: frame - numpy数组(BGR)
        返回: 与detect_image相同格式，额外包含results用于绘制
        """
        all_detections = []

        # ========== 1. 主模型检测（不用TTA，提升视频处理速度） ==========
        try:
            results = self.primary_model(
                frame, conf=conf_thres, imgsz=imgsz, augment=False, verbose=False
            )[0]
        except Exception as e:
            print(f"⚠️ 主模型帧检测失败: {e}")
            results = None

        if results is not None and results.boxes is not None and len(results.boxes) > 0:
            for box in results.boxes:
                cls_id = int(box.cls[0])
                conf_val = float(box.conf[0])
                class_name = self.primary_names[cls_id] if cls_id < len(self.primary_names) else f"class_{cls_id}"
                category, hazard_type = self._classify(class_name)

                all_detections.append({
                    'class_id': cls_id,
                    'class_name': class_name,
                    'class_name_normalized': class_name.lower().replace('-', '_'),
                    'confidence': round(conf_val, 2),
                    'category': category,
                    'hazard_type': hazard_type,
                    'is_hazard': category == 'hazard',
                    'bbox': [round(x, 1) for x in box.xyxy[0].tolist()],
                    'time': time.strftime("%Y-%m-%d %H:%M:%S"),
                    'camera_id': "视频检测",
                    'source': 'primary',
                    'inferred': False
                })

        # ========== 2. COCO补充模型检测person ==========
        if self.coco_model is not None:
            try:
                coco_results = self.coco_model(
                    frame, conf=max(conf_thres, 0.3), imgsz=imgsz, verbose=False
                )[0]

                if coco_results.boxes is not None and len(coco_results.boxes) > 0:
                    for box in coco_results.boxes:
                        cls_id = int(box.cls[0])
                        conf_val = float(box.conf[0])
                        class_name = self.coco_names.get(cls_id, f"class_{cls_id}")

                        if class_name.lower() != 'person':
                            continue

                        new_bbox = box.xyxy[0].tolist()
                        is_duplicate = False
                        for d in all_detections:
                            if d['class_name'].lower() in ('person', 'none'):
                                if self._iou(new_bbox, d['bbox']) > 0.5:
                                    is_duplicate = True
                                    break

                        if not is_duplicate:
                            all_detections.append({
                                'class_id': cls_id,
                                'class_name': 'person',
                                'class_name_normalized': 'person',
                                'confidence': round(conf_val, 2),
                                'category': 'neutral',
                                'hazard_type': 'person',
                                'is_hazard': False,
                                'bbox': [round(x, 1) for x in new_bbox],
                                'time': time.strftime("%Y-%m-%d %H:%M:%S"),
                                'camera_id': "视频检测",
                                'source': 'coco',
                                'inferred': False
                            })
            except Exception as e:
                print(f"⚠️ COCO模型帧检测失败: {e}")

        # ========== 3. 后处理推断：person无防护装备 → 隐患 ==========
        inferred = self._infer_missing_ppe(all_detections)
        all_detections.extend(inferred)

        # ========== 4. 去重 ==========
        deduped = self._deduplicate(all_detections)
        hazards = [d for d in deduped if d['is_hazard']]

        return {
            "all_detections": deduped,
            "hazards": hazards,
            "total_count": len(deduped),
            "hazard_count": len(hazards),
            "inferred_count": len(inferred),
            "results": results
        }

    def draw_detections(self, frame, detections):
        """
        在视频帧上绘制检测结果（与图像检测标注一致）
        颜色方案: 隐患=红色, 正常=绿色, 中性=蓝色, 推断=橙色
        """
        import cv2
        colors = {
            'hazard': (0, 0, 255),
            'normal': (0, 255, 0),
            'neutral': (255, 0, 0),
            'inferred': (0, 165, 255),
        }

        for d in detections:
            bbox = d.get('bbox')
            if not bbox or len(bbox) != 4:
                continue
            x1, y1, x2, y2 = [int(v) for v in bbox]

            if d.get('inferred'):
                color = colors['inferred']
            elif d['is_hazard']:
                color = colors['hazard']
            elif d['category'] == 'normal':
                color = colors['normal']
            else:
                color = colors['neutral']

            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)

            label = f"{d['hazard_type']} {d['confidence']:.2f}"
            if d.get('inferred'):
                label = f"推断: {label}"

            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
            cv2.rectangle(frame, (x1, y1 - th - 6), (x1 + tw, y1), color, -1)
            cv2.putText(frame, label, (x1, y1 - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

        return frame
