# backend/app/services/verification.py
"""
Real image-based verification checks used by the licence submission pipeline.

Checks performed:
  1. Pillow — image quality: minimum resolution, not blank, not too dark
  2. Pillow — licence orientation: card must be landscape (wider than tall)
  3. OpenCV Haar cascade — selfie must contain a detectable human face
"""

import io

import cv2
import numpy as np
from PIL import Image, UnidentifiedImageError


def _load_pillow(image_bytes: bytes, label: str) -> tuple[Image.Image | None, str | None]:
    """Open an image from bytes, return (img, None) or (None, error_message)."""
    try:
        # verify() detects truncated / corrupt files; re-open afterwards for use
        Image.open(io.BytesIO(image_bytes)).verify()
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        return img, None
    except (UnidentifiedImageError, Exception):
        return None, f"{label}: could not read image — please upload a valid photo (JPEG or PNG)"



def check_image_quality(image_bytes: bytes, label: str) -> tuple[bool, str]:
    """
    Reject images that are:
      - Unreadable / corrupt
      - Too small (below 200 × 100 px)
      - Nearly black (average brightness < 20)
      - Nearly white / blank (average brightness > 235)
    """
    img, err = _load_pillow(image_bytes, label)
    if err:
        return False, err

    w, h = img.size
    if w < 200 or h < 100:
        return (
            False,
            f"{label}: image is too small ({w}×{h}px — minimum 200×100px). "
            "Please use a higher-quality photo.",
        )

    gray = img.convert("L")
    pixels = list(gray.getdata())
    avg = sum(pixels) / len(pixels)

    if avg < 20:
        return (
            False,
            f"{label}: image is too dark. Please ensure good lighting and try again.",
        )
    if avg > 235:
        return (
            False,
            f"{label}: image appears blank. Please upload a real photo.",
        )

    return True, ""


def check_licence_orientation(image_bytes: bytes) -> tuple[bool, str]:
    """
    A physical driving licence is always wider than tall (landscape).
    Reject portrait-orientation licence photos.
    """
    img, err = _load_pillow(image_bytes, "Licence photo")
    if err:
        return False, err

    w, h = img.size
    if h > w:
        return (
            False,
            "Licence photo must be in landscape orientation — "
            "please photograph the card horizontally.",
        )

    return True, ""


def detect_face_in_selfie(image_bytes: bytes) -> tuple[bool, str]:
    """
    Use OpenCV's pre-trained Haar cascade to detect at least one frontal face
    in the selfie image.
    """
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        return False, "Could not decode selfie image — please upload a valid photo."

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    face_cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    )
    faces = face_cascade.detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=5,
        minSize=(30, 30),
    )

    if len(faces) == 0:
        return (
            False,
            "No face detected in your selfie. "
            "Please upload a clear, front-facing photo with good lighting.",
        )

    return True, ""



def run_verification_checks(
    photo_bytes: bytes,
    selfie_bytes: bytes,
) -> tuple[bool, str | None]:
    """
    Run all checks in order.  Returns (passed: bool, rejection_reason: str | None).
    The first failing check short-circuits the rest.
    """
    checks = [
        lambda: check_image_quality(photo_bytes, "Licence photo"),
        lambda: check_licence_orientation(photo_bytes),
        lambda: check_image_quality(selfie_bytes, "Selfie"),
        lambda: detect_face_in_selfie(selfie_bytes),
    ]

    for check in checks:
        ok, reason = check()
        if not ok:
            return False, reason

    return True, None
