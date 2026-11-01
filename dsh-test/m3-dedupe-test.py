#!/usr/bin/env python
"""M3 多目标去重单元测试。

不加载 YOLO 权重，只验证实例级去重规则：
1. 3 个不同人的同类隐患 -> 3 条；
2. 同一人的直检框 + 推断框 -> 1 条；
3. 多人推断隐患不被合并。
"""
import os
import sys

PY_ROOT = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "工地安全多角色协同大模型Agent",
    "工地安全多角色协同大模型Agent",
)
sys.path.insert(0, PY_ROOT)
os.environ.setdefault("YOLO_CONFIG_DIR", os.path.join(PY_ROOT, ".ultralytics"))

from multi_detect import EnhancedMultiHazardDetector


def person(x1, y1, x2, y2, conf=0.9):
    return {
        "category": "neutral",
        "hazard_type": "person",
        "class_name": "person",
        "is_hazard": False,
        "confidence": conf,
        "bbox": [x1, y1, x2, y2],
    }


def hazard(x1, y1, x2, y2, conf=0.8, inferred=False):
    return {
        "category": "hazard",
        "hazard_type": "未佩戴安全帽",
        "class_name": "no-hardhat",
        "is_hazard": True,
        "confidence": conf,
        "bbox": [x1, y1, x2, y2],
        "inferred": inferred,
        "source": "primary",
    }


def main():
    detector = EnhancedMultiHazardDetector.__new__(EnhancedMultiHazardDetector)

    cases = [
        (
            "3 个不同人",
            [
                person(0, 0, 100, 300),
                person(100, 0, 200, 300),
                person(200, 0, 300, 300),
                hazard(20, 20, 80, 100),
                hazard(120, 20, 180, 100),
                hazard(220, 20, 280, 100),
            ],
            3,
        ),
        (
            "同一人直检+推断",
            [
                person(0, 0, 100, 300),
                hazard(20, 20, 80, 100, 0.9, False),
                hazard(0, 0, 100, 300, 0.8, True),
            ],
            1,
        ),
        (
            "3 人各自推断",
            [
                person(0, 0, 100, 300),
                person(100, 0, 200, 300),
                person(200, 0, 300, 300),
                hazard(0, 0, 100, 300, 0.8, True),
                hazard(100, 0, 200, 300, 0.8, True),
                hazard(200, 0, 300, 300, 0.8, True),
            ],
            3,
        ),
    ]

    failed = 0
    for name, detections, expected in cases:
        result = [d for d in detector._deduplicate(detections) if d["is_hazard"]]
        ok = len(result) == expected
        failed += 0 if ok else 1
        print(f"[{'PASS' if ok else 'FAIL'}] {name}: {len(result)} 条（期望 {expected}）")

    if failed:
        raise SystemExit(1)
    print("M3 去重单元测试全部通过")


if __name__ == "__main__":
    main()
