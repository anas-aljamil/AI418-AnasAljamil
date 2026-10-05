"""Request and response bodies (Pydantic v2).

Times leave the API as ISO 8601 UTC with a trailing "Z"; schedule times as
"HH:MM" (Riyadh wall clock). Incoming timestamps must carry a time zone.
"""

from datetime import UTC, date, datetime, time
from typing import Annotated, Literal

from pydantic import (
    AfterValidator,
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    PlainSerializer,
    field_validator,
)

from app.core.clock import to_naive_utc

# --- shared field types ------------------------------------------------------

UtcDatetime = Annotated[
    datetime,
    PlainSerializer(lambda d: d.replace(tzinfo=UTC).isoformat().replace("+00:00", "Z"), return_type=str),
]
ClockTime = Annotated[time, PlainSerializer(lambda t: t.strftime("%H:%M"), return_type=str)]


def _strip_or_none(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value or None


def _on_quarter_hour(value: time) -> time:
    if value.minute % 15 or value.second or value.microsecond:
        raise ValueError("must be on a 15-minute boundary (e.g. 09:00, 09:15)")
    return value


def _optional_text(max_length: int):
    """Optional free text: null or blank becomes None, and the length limit applies to the
    string only (a limit on the whole `str | None` would be applied to None and crash)."""
    return Annotated[
        Annotated[str, Field(max_length=max_length)] | None,
        AfterValidator(_strip_or_none),
        Field(default=None),
    ]


OptionalText40 = _optional_text(40)
OptionalText60 = _optional_text(60)
OptionalText200 = _optional_text(200)
QuarterHour = Annotated[time, AfterValidator(_on_quarter_hour)]
Email = Annotated[str, Field(max_length=254, pattern=r"^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$")]
Password = Annotated[str, Field(min_length=8, max_length=128)]
NameAr = Annotated[str, Field(min_length=2, max_length=100)]
NameEn = Annotated[str, Field(min_length=2, max_length=100)]

StatusValue = Literal["in_office", "in_class", "busy", "away"]
Topic = Literal["assignment", "exam_review", "advising", "other"]
Locale = Literal["ar", "en"]
Honorific = Literal["dr", "prof", "mr", "ms", "eng"]
Rank = Literal["lecturer", "assistant_professor", "associate_professor", "professor"]


class Out(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --- reference data ----------------------------------------------------------


class DepartmentOut(Out):
    department_id: int
    code: str
    name_ar: str
    name_en: str


class OfficeOut(Out):
    office_id: int
    building_code: str
    floor: int
    room_number: str


class BlockOut(Out):
    block_id: int
    kind: Literal["office_hours", "class"]
    day_of_week: int
    start_time: ClockTime
    end_time: ClockTime
    label: str | None


# --- auth --------------------------------------------------------------------


class LoginIn(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(max_length=128)
    # "native" returns the refresh token in the body (stored in expo-secure-store);
    # "web" sets it as an httpOnly cookie instead.
    client: Literal["native", "web"] = "native"

    @field_validator("email")
    @classmethod
    def lower(cls, value: str) -> str:
        return value.strip().lower()


class RefreshIn(BaseModel):
    refresh_token: str | None = None


class StudentProfileOut(Out):
    university_no: str
    study_year: int
    department: DepartmentOut


class ProfessorProfileOut(Out):
    honorific: str
    academic_rank: str
    slot_minutes: int
    open_messages: bool
    department: DepartmentOut
    office: OfficeOut | None


class MeOut(BaseModel):
    user_id: int
    email: str
    role: str
    full_name_ar: str
    full_name_en: str
    preferred_locale: str
    student: StudentProfileOut | None = None
    professor: ProfessorProfileOut | None = None


class TokenOut(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"  # noqa: S105 (OAuth token type, not a secret)
    access_expires_at: UtcDatetime
    refresh_token: str | None = None  # only for native clients
    user: MeOut


# --- professors and status ---------------------------------------------------


class StatusOut(BaseModel):
    status: Literal["in_office", "in_class", "busy", "away", "unknown"]
    confirmed: bool
    source: Literal["override", "schedule", "none"]
    note: str | None
    until: UtcDatetime | None
    updated_at: UtcDatetime | None
    schedule_status: str


class ProfessorSummaryOut(BaseModel):
    professor_id: int
    full_name_ar: str
    full_name_en: str
    honorific: str
    academic_rank: str
    department: DepartmentOut
    office: OfficeOut | None
    status: StatusOut
    has_office_hours_today: bool
    is_pinned: bool | None = None  # set for students only


class TodayOut(BaseModel):
    date: date
    day_of_week: int
    now_local_time: ClockTime
    blocks: list[BlockOut]


class ProfessorDetailOut(ProfessorSummaryOut):
    slot_minutes: int
    open_messages: bool
    today: TodayOut


class SlotOut(BaseModel):
    starts_at: UtcDatetime
    ends_at: UtcDatetime
    local_time: ClockTime
    available: bool
    reason: Literal["past", "taken"] | None


class DaySlotsOut(BaseModel):
    professor_id: int
    date: date
    slot_minutes: int
    slots: list[SlotOut]


class StatusIn(BaseModel):
    status: StatusValue
    note: OptionalText60
    # Optional "back at" time; without it the update lasts until the end of the Riyadh day.
    expires_at: AwareDatetime | None = None


class BlockIn(BaseModel):
    kind: Literal["office_hours", "class"] = "office_hours"
    day_of_week: int = Field(ge=0, le=4, description="0 = Sunday ... 4 = Thursday")
    start_time: QuarterHour
    end_time: QuarterHour
    label: OptionalText40

    @field_validator("end_time")
    @classmethod
    def after_start(cls, end: time, info) -> time:
        start = info.data.get("start_time")
        if start is not None and end <= start:
            raise ValueError("must be after start_time")
        return end


class ProfessorSettingsIn(BaseModel):
    slot_minutes: Literal[15, 30] | None = None
    open_messages: bool | None = None


# --- appointments ------------------------------------------------------------


class PersonOut(BaseModel):
    user_id: int
    full_name_ar: str
    full_name_en: str


class AppointmentProfessorOut(PersonOut):
    honorific: str
    office: OfficeOut | None


class AppointmentOut(BaseModel):
    appointment_id: int
    status: Literal["pending", "approved", "declined", "cancelled", "completed", "no_show"]
    starts_at: UtcDatetime
    ends_at: UtcDatetime
    cancel_deadline: UtcDatetime  # cancellation closes 1 hour before the start
    topic: str | None
    note: str | None
    created_at: UtcDatetime
    updated_at: UtcDatetime
    student: PersonOut
    professor: AppointmentProfessorOut


class BookingIn(BaseModel):
    professor_id: int
    starts_at: AwareDatetime
    topic: Topic | None = None
    note: OptionalText200

    def starts_at_utc(self) -> datetime:
        return to_naive_utc(self.starts_at)


# --- admin -------------------------------------------------------------------


class DepartmentIn(BaseModel):
    code: str = Field(pattern=r"^[A-Z]{2,10}$")
    name_ar: NameAr
    name_en: NameEn


class DepartmentPatch(BaseModel):
    code: str | None = Field(default=None, pattern=r"^[A-Z]{2,10}$")
    name_ar: NameAr | None = None
    name_en: NameEn | None = None


class OfficeIn(BaseModel):
    building_code: str = Field(pattern=r"^[A-Z0-9]{1,10}$")
    floor: int = Field(default=0, ge=0, le=20)
    room_number: str = Field(pattern=r"^[A-Z0-9-]{1,10}$")


class OfficePatch(BaseModel):
    building_code: str | None = Field(default=None, pattern=r"^[A-Z0-9]{1,10}$")
    floor: int | None = Field(default=None, ge=0, le=20)
    room_number: str | None = Field(default=None, pattern=r"^[A-Z0-9-]{1,10}$")


class AccountIn(BaseModel):
    email: Email
    password: Password
    full_name_ar: NameAr
    full_name_en: NameEn
    preferred_locale: Locale = "ar"


class AccountPatch(BaseModel):
    email: Email | None = None
    password: Password | None = None
    full_name_ar: NameAr | None = None
    full_name_en: NameEn | None = None
    preferred_locale: Locale | None = None
    is_active: bool | None = None


class AdminProfessorIn(AccountIn):
    department_id: int
    office_id: int | None = None
    honorific: Honorific = "dr"
    academic_rank: Rank = "assistant_professor"
    slot_minutes: Literal[15, 30] = 15
    open_messages: bool = False


class AdminProfessorPatch(AccountPatch):
    department_id: int | None = None
    office_id: int | None = None
    honorific: Honorific | None = None
    academic_rank: Rank | None = None
    slot_minutes: Literal[15, 30] | None = None
    open_messages: bool | None = None


class AdminStudentIn(AccountIn):
    university_no: str = Field(pattern=r"^[A-Z0-9]{4,12}$")
    department_id: int
    study_year: int = Field(default=1, ge=1, le=6)


class AdminStudentPatch(AccountPatch):
    university_no: str | None = Field(default=None, pattern=r"^[A-Z0-9]{4,12}$")
    department_id: int | None = None
    study_year: int | None = Field(default=None, ge=1, le=6)


class AccountOut(Out):
    user_id: int
    email: str
    full_name_ar: str
    full_name_en: str
    preferred_locale: str
    is_active: bool
    created_at: UtcDatetime


class AdminProfessorOut(AccountOut):
    department: DepartmentOut
    office: OfficeOut | None
    honorific: str
    academic_rank: str
    slot_minutes: int
    open_messages: bool


class AdminStudentOut(AccountOut):
    university_no: str
    department: DepartmentOut
    study_year: int
