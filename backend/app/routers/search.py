from __future__ import annotations

import json
from datetime import date

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/search", tags=["search"])


class ParseRequest(BaseModel):
    query: str


class ParsedFilters(BaseModel):
    city: str | None = None
    make: str | None = None            # car manufacturer e.g. "Toyota"
    minPrice: int | None = None
    maxPrice: int | None = None
    transmission: str | None = None   # AUTOMATIC | MANUAL
    fuelType: str | None = None        # PETROL | DIESEL | HYBRID | ELECTRIC
    minSeats: int | None = None        # one of 2, 4, 5, 7
    startDate: str | None = None       # YYYY-MM-DD
    endDate: str | None = None         # YYYY-MM-DD


_SYSTEM_PROMPT = """You are a search parameter extractor for a UK peer-to-peer car rental platform called CarHop.
Today's date is {today}.

Extract rental search parameters from the user's natural language query.
Return ONLY a valid JSON object. Omit fields that are not mentioned or clearly implied.

Supported fields:
- "city": string — city or town name (e.g. "Bristol")
- "make": string — car manufacturer / brand (e.g. "Toyota", "BMW", "Ford", "Volkswagen")
- "minPrice": integer — minimum daily rental price in GBP (positive)
- "maxPrice": integer — maximum daily rental price in GBP (positive)
- "transmission": "AUTOMATIC" or "MANUAL"
- "fuelType": "PETROL", "DIESEL", "HYBRID", or "ELECTRIC"
- "minSeats": integer — minimum seats required, must be one of: 2, 4, 5, 7
- "startDate": string — ISO date YYYY-MM-DD
- "endDate": string   — ISO date YYYY-MM-DD

Date resolution rules (reference date: {today}):
- "this weekend"   → nearest upcoming Saturday (startDate) to Sunday (endDate)
- "next weekend"   → the weekend after this coming weekend
- "next week"      → next Monday to next Sunday
- "tomorrow"       → tomorrow as startDate, day after as endDate
- Single named day (e.g. "Friday") → that day as startDate, the following day as endDate

Return ONLY the JSON object. No markdown fences, no explanation, no extra text."""


@router.post("/parse", response_model=ParsedFilters)
async def parse_search_query(body: ParseRequest):
    """
    Use OpenAI to parse a natural language search query into structured car search filters.
    Requires OPENAI_API_KEY to be configured.
    """
    from app.config import settings

    if not settings.openai_api_key:
        raise HTTPException(
            status_code=503,
            detail="AI search is not configured. Set OPENAI_API_KEY to enable it.",
        )

    query = body.query.strip()
    if not query:
        raise HTTPException(status_code=422, detail="Query cannot be empty.")

    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.openai_api_key)
    except ImportError as exc:
        raise HTTPException(
            status_code=503,
            detail="openai package is not installed.",
        ) from exc

    today = date.today().isoformat()
    system_prompt = _SYSTEM_PROMPT.format(today=today)

    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": query},
            ],
            response_format={"type": "json_object"},
            max_tokens=256,
            temperature=0,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"OpenAI request failed: {exc}") from exc

    raw = (response.choices[0].message.content or "{}").strip()

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=422,
            detail="Could not interpret the AI response. Try rephrasing your query.",
        ) from exc

    _valid_transmissions = {"AUTOMATIC", "MANUAL"}
    _valid_fuel_types = {"PETROL", "DIESEL", "HYBRID", "ELECTRIC"}
    _valid_seats = {2, 4, 5, 7}

    result: dict = {}

    if isinstance(parsed.get("city"), str) and parsed["city"].strip():
        result["city"] = parsed["city"].strip()

    if isinstance(parsed.get("make"), str) and parsed["make"].strip():
        result["make"] = parsed["make"].strip()

    for price_key in ("minPrice", "maxPrice"):
        val = parsed.get(price_key)
        if isinstance(val, (int, float)) and val > 0:
            result[price_key] = int(val)

    if parsed.get("transmission") in _valid_transmissions:
        result["transmission"] = parsed["transmission"]

    if parsed.get("fuelType") in _valid_fuel_types:
        result["fuelType"] = parsed["fuelType"]

    raw_seats = parsed.get("minSeats")
    if raw_seats is not None:
        try:
            seats_int = int(raw_seats)
            if seats_int in _valid_seats:
                result["minSeats"] = seats_int
        except (TypeError, ValueError):
            pass

    for date_key in ("startDate", "endDate"):
        val = parsed.get(date_key)
        if isinstance(val, str) and len(val) == 10:
            try:
                date.fromisoformat(val)   # validate it's a real date
                result[date_key] = val
            except ValueError:
                pass

    return result
