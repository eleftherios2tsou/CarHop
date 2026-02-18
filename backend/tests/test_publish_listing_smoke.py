def test_publish_listing_with_photo_upload(client):
    test_client, uploads_dir = client

    create_payload = {
        "make": "Toyota",
        "model": "Corolla",
        "year": 2020,
        "daily_price": 55,
        "availability_units": 1,
        "city": "Bristol",
        "postcode": "BS1",
        "transmission": "AUTOMATIC",
        "fuel_type": "PETROL",
        "seats": 5,
        "doors": 5,
        "mileage": 25000,
        "color": "Grey",
        "description": "Smoke test listing",
        "features": {"ac": True},
    }

    create_res = test_client.post("/cars/", json=create_payload)
    assert create_res.status_code == 200, create_res.text
    car = create_res.json()
    car_id = car["id"]

    files = [("files", ("car.jpg", b"fake-image-data", "image/jpeg"))]
    upload_res = test_client.post(f"/cars/{car_id}/photos", files=files)
    assert upload_res.status_code == 200, upload_res.text
    upload_body = upload_res.json()
    assert upload_body["car_id"] == car_id
    assert len(upload_body["photo_urls"]) == 1
    assert upload_body["photo_urls"][0].startswith(f"/uploads/cars/{car_id}/")

    detail_res = test_client.get(f"/cars/{car_id}")
    assert detail_res.status_code == 200, detail_res.text
    detail = detail_res.json()
    assert len(detail["photos"]) == 1

    stored_files = list((uploads_dir / "cars" / str(car_id)).glob("*"))
    assert len(stored_files) == 1
