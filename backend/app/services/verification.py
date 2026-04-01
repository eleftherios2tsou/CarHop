# backend/app/services/verification.py
# image-based verification checks used by the licence submission pipeline
# we run these automatically when a user uploads their documents — no human review needed
# for borderline cases the pipeline sets status to "manual_review" instead of rejecting outright
#
# Checks performed:
#   1. Pillow — image quality: minimum resolution, not blank, not too dark
#   2. Pillow — licence orientation: card must be landscape (wider than tall)
#   3. OpenCV Haar cascade — selfie must contain a detectable human face

import io

import cv2
import numpy as np
from PIL import Image, UnidentifiedImageError


def _load_pillow(image_bytes: bytes, label: str) -> tuple[Image.Image | None, str | None]:
    # try to open the image with Pillow — returns (image, None) on success or (None, error) on failure
    # we call verify() first to catch truncated/corrupt files, then re-open for actual use
    # (verify() consumes the stream so we need a fresh BytesIO for the second open)
    try:
        Image.open(io.BytesIO(image_bytes)).verify()
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        return img, None
    except (UnidentifiedImageError, Exception):
        return None, f"{label}: could not read image — please upload a valid photo (JPEG or PNG)"


def check_image_quality(image_bytes: bytes, label: str) -> tuple[bool, str]:
    # reject images that are unreadable, too small, too dark, or completely blank
    # these checks catch common upload mistakes (e.g. wrong file, camera covered, overexposed)
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

    # convert to grayscale and compute average pixel brightness (0 = black, 255 = white)
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
    # a real driving licence card is always wider than it is tall (landscape orientation)
    # if the photo is portrait it's almost certainly held the wrong way or it's not a licence
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
    # use OpenCV's pre-trained Haar cascade classifier to detect at least one frontal face
    # this is a fast, offline check that doesn't require any external API calls
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        return False, "Could not decode selfie image — please upload a valid photo."

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    # the cascade XML file is bundled with OpenCV — no manual download needed
    face_cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    )
    faces = face_cascade.detectMultiScale(
        gray,
        scaleFactor=1.1,   # how much the image is scaled down at each level of the pyramid
        minNeighbors=5,    # how many neighbours a candidate rectangle needs to be retained
        minSize=(30, 30),  # minimum face size in pixels — filters out noise
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
    # run all checks in sequence — the first failure short-circuits the rest
    # returns (True, None) if everything passes, or (False, reason) if any check fails
    checks = [
        lambda: check_image_quality(photo_bytes, "Licence photo"),
        lambda: check_licence_orientation(photo_bytes),
        lambda: check_image_quality(selfie_bytes, "Selfie"),
        lambda: detect_face_in_selfie(selfie_bytes),
    ]

    for check in checks:
        ok, reason = check()
        if not ok:
            return False, reason  # return the first failure reason to show to the user

    return True, None  # all checks passed
