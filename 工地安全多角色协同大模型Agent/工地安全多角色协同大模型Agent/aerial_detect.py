import os
import time

from ultralytics import YOLO


class AerialPileDetector:
    """航拍堆料检测：只输出 pile 框，不做状态/等级判断。"""

    def __init__(self, weights_path=None):
        base = os.path.dirname(os.path.abspath(__file__))
        self.weights_path = weights_path or os.path.join(base, "weights", "aerial_pile.pt")
        self._model = None

    @property
    def model(self):
        if self._model is None:
            if not os.path.exists(self.weights_path):
                raise FileNotFoundError(f"航拍模型不存在: {self.weights_path}")
            self._model = YOLO(self.weights_path)
        return self._model

    def predict(self, image_path, conf=0.25, imgsz=1280):
        started = time.time()
        result = self.model.predict(image_path, conf=conf, imgsz=imgsz, verbose=False)[0]
        names = result.names
        height, width = result.orig_shape
        piles = []
        for box in result.boxes:
            cls_id = int(box.cls[0])
            if names.get(cls_id) not in ("pile", "材料堆放", "堆料"):
                continue
            x1, y1, x2, y2 = [float(v) for v in box.xyxy[0]]
            piles.append({
                "class_id": cls_id,
                "label": "pile",
                "confidence": round(float(box.conf[0]), 4),
                "bbox": [round(x1 / width, 5), round(y1 / height, 5),
                         round(x2 / width, 5), round(y2 / height, 5)],
                "bbox_px": [round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1)],
            })
        piles.sort(key=lambda item: item["confidence"], reverse=True)
        return {
            "count": len(piles),
            "piles": piles,
            "width": width,
            "height": height,
            "elapsed": round(time.time() - started, 3),
            "model": os.path.basename(self.weights_path),
        }
