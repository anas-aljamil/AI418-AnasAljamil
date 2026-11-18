"""What signed-in people read about each other beyond the directory (owner request S5b,
2026-11-18): profile photos, and the offices a professor can choose from."""

import base64

from fastapi import APIRouter, Depends, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import not_found
from app.core.pagination import Page, PageParams, page_params, paginate
from app.db import get_db
from app.deps import get_current_user, require_role
from app.models import Office, User
from app.schemas import OfficeOut, PhotoOut

router = APIRouter(tags=["people"])


def may_see_photo(viewer: User, owner: User) -> bool:
    """A professor's photo is for everyone signed in, like the directory. A student's is for
    the student, professors and admins; an admin's for admins. An inactive account's photo is
    for its owner and admins only."""
    if viewer.user_id == owner.user_id or viewer.role == "admin":
        return True
    if not owner.is_active:
        return False
    if owner.role == "professor":
        return True
    return owner.role == "student" and viewer.role == "professor"


@router.get("/users/{user_id}/photo", response_model=PhotoOut, summary="A person's profile photo")
def get_photo(
    user_id: int,
    response: Response,
    viewer: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PhotoOut:
    owner = db.get(User, user_id)
    # Someone the viewer may not see and someone without a photo look the same: not found.
    if owner is None or owner.photo_updated_at is None or not may_see_photo(viewer, owner):
        raise not_found("Photo")
    # The app asks again with ?v=<photo_updated_at> when the photo changes.
    response.headers["Cache-Control"] = "private, max-age=86400"
    return PhotoOut(
        user_id=owner.user_id,
        content_type=owner.photo_type,
        data=base64.b64encode(owner.photo).decode("ascii"),
        updated_at=owner.photo_updated_at,
    )


@router.get(
    "/offices",
    response_model=Page[OfficeOut],
    summary="Offices to choose from (professors and admins)",
    dependencies=[Depends(require_role("professor", "admin"))],
)
def list_offices(page: PageParams = Depends(page_params), db: Session = Depends(get_db)) -> Page[OfficeOut]:
    rows = db.scalars(select(Office).order_by(Office.building_code, Office.floor, Office.room_number))
    return paginate([OfficeOut.model_validate(o) for o in rows], page)
