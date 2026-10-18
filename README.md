# Smart Fridge System

An Edge AI smart-fridge prototype for recognizing food, estimating freshness, and
tracking inventory. The project combines a lightweight computer-vision pipeline,
VOC/e-nose sensor data, and a SQLite inventory database. It is designed around
deployment on an NVIDIA Jetson Orin Nano, with ONNX export for edge inference.

## What the prototype demonstrates

- Generates a reproducible mock vision dataset for bananas, oranges, and tomatoes.
- Creates YOLO-format train/validation splits and annotations.
- Configures and trains an Ultralytics YOLOv8n model for a short pipeline test.
- Reports `mAP50` and `mAP50-95` validation metrics.
- Exports the trained model to ONNX for Jetson-compatible deployment.
- Initializes a SQLite inventory database with quantities, freshness status, and
  update timestamps.
- Provides templates for combining visual predictions with VOC readings and
  inventory changes.

> **Prototype status:** The repository currently contains an experimental,
> notebook-style Python pipeline. The included images and bounding boxes are
> generated mock data for demonstrating the workflow; they are not a production
> food-freshness model or a validated food-safety system.

## Repository contents

| File | Purpose |
| --- | --- |
| `smart_fridge_system.py` | End-to-end Colab/Python pipeline for setup, mock data generation, YOLO training/evaluation/export, and SQLite inventory initialization |
| `data/raw_vision/` | Generated source images grouped by food type |
| `data/raw_voc/` | Reserved for VOC/e-nose sensor data |
| `dataset/` | YOLO images, labels, and generated `dataset.yaml` configuration |
| `models/` | Training outputs, weights, and exported models |
| `database/` | SQLite inventory database |

Most directories are created by the script at runtime and are intentionally not
required to be committed to source control.

## Requirements

- Python 3.9 or newer
- A Google Colab runtime or a local Python environment
- Ultralytics and its dependencies
- OpenCV, Pillow, NumPy, pandas, PyYAML, and SQLite (included with Python)
- CUDA-capable hardware is recommended for training; CPU execution is suitable
  only for small tests

Install the Python dependencies in a virtual environment:

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
# source .venv/bin/activate
pip install ultralytics opencv-python pillow numpy pandas pyyaml
```

The source file also contains a Colab-only `!pip install` cell. In a local
environment, install the packages with the command above instead.

## Run the pipeline

The source file is exported from Google Colab and includes notebook-style
markdown and shell cells. The simplest way to run it is to open the linked
Colab notebook in the file header, upload `smart_fridge_system.py`, and execute
the cells in order. In a local environment, remove the `!pip install` line
before running the file as Python.

After the dependencies are installed, the equivalent command is:

```bash
python smart_fridge_system.py
```

The script will:

1. Create the project directories.
2. Generate mock food images.
3. Create YOLO train/validation splits and `dataset/dataset.yaml`.
4. Train YOLOv8n for three epochs as a smoke test.
5. Print validation metrics and export the model to ONNX.
6. Initialize the inventory database at
   `database/fridge_inventory.db`.

Training outputs are written below `models/runs/smart_fridge_yolo/`. Training
downloads the base `yolov8n.pt` weights on the first run.

## Using real data

Replace the generated mock images with representative, legally sourced images
captured in realistic fridge conditions. For a useful detector:

1. Add train/validation images under `dataset/images/train` and
   `dataset/images/val`.
2. Add matching YOLO label files under `dataset/labels/train` and
   `dataset/labels/val`.
3. Update the class names in `dataset/dataset.yaml`.
4. Collect VOC readings with timestamps and matching food/freshness labels.
5. Re-run training and evaluate on a held-out test set before deployment.

The current mock bounding boxes are centrally placed demonstration labels and
must not be treated as ground-truth annotations.

## Edge deployment direction

The trained model is exported to ONNX because ONNX Runtime and TensorRT are
appropriate options for Jetson-class hardware. A production deployment still
needs:

- Camera capture and preprocessing on the Jetson
- Arduino or other sensor transport for VOC readings
- A fusion/calibration layer for vision and sensor confidence
- A service/API for serving status, vision, sensor, history, inventory, and
  notification data
- Monitoring, retraining, and food-safety validation

## Related dashboard

The companion React dashboard is maintained separately. It can run in mock mode
before the Jetson API is available and is intended to consume the edge-service
data described above.

## License and data

No license or third-party dataset is currently declared in this repository.
Before distributing the project, add an appropriate license and document the
licenses and provenance of any real datasets or pretrained weights used.