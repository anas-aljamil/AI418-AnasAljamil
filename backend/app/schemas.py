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
    BeforeValidator,
    ConfigDict,
    Field,
    PlainSerializer,
    field_validator,
    model_validator,
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
# Timetable block kinds: office hours -> in_office, class -> in_class, meeting -> busy.
BlockKind = Literal["office_hours", "class", "meeting"]
Topic = Literal["assignment", "exam_review", "advising", "other"]
Locale = Literal["ar", "en"]
Honorific = Literal["dr", "prof", "mr", "ms", "eng"]
Rank = Literal["lecturer", "assistant_professor", "associate_professor", "professor"]


class Out(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --- reference data ----------------------------------------------------------


class CollegeOut(Out):
    college_id: int
    code: str
    name_ar: str
    name_en: str


class DepartmentOut(Out):
    department_id: int
    code: str
    name_ar: str
    name_en: str
    college: CollegeOut


class OfficeOut(Out):
    office_id: int
    building_code: str
    floor: int
    room_number: str


class BlockOut(Out):
    block_id: int
    kind: BlockKind
    day_of_week: int | None  # weekly rows; None for a dated row
    on_date: date | None  # the date of a row that happens once
    ends_on: date | None  # the last date of a weekly row, if it ends
    skipped_dates: list[date]  # dates a weekly row does not happen
    start_time: ClockTime
    end_time: ClockTime
    label: str | None


class PeriodOut(Out):
    """A booking period: weekly (Sunday-Thursday) or on one working day."""

    period_id: int
    day_of_week: int | None  # weekly rows; None for a dated row
    on_date: date | None  # the date of a row that happens once
    ends_on: date | None  # the last date of a weekly row, if it ends
    skipped_dates: list[date]  # dates a weekly row does not happen
    start_time: ClockTime
    end_time: ClockTime


class ClosureOut(Out):
    """Closed hours for student messages, weekly or on one date; end <= start runs into the
    next day."""

    closure_id: int
    day_of_week: int | None  # weekly rows; None for a dated row
    on_date: date | None  # the date of a row that happens once
    ends_on: date | None  # the last date of a weekly row, if it ends
    skipped_dates: list[date]  # dates a weekly row does not happen
    start_time: ClockTime
    end_time: ClockTime


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
    today: TodayOut
    # The times students can book in; empty means the professor cannot be booked.
    booking_periods: list[PeriodOut]
    # The days of the booking window (this week and next) that have a booking time.
    booking_days: list[date]
    # Set while the professor's closed hours are on: students can write again at this time.
    messages_closed_until: UtcDatetime | None


class SlotOut(BaseModel):
    starts_at: UtcDatetime
    local_time: ClockTime
    available: bool
    reason: Literal["past", "taken"] | None
    # Longest appointment that can start here (5-minute steps; 0 when not available).
    max_minutes: int


class DaySlotsOut(BaseModel):
    professor_id: int
    date: date
    # The length offered first; any length in 5-minute steps is allowed.
    default_minutes: int
    step_minutes: int
    slots: list[SlotOut]


class StatusIn(BaseModel):
    status: StatusValue
    note: OptionalText60
    # Optional "back at" time; without it the update lasts until the end of the Riyadh day.
    expires_at: AwareDatetime | None = None


class WhenIn(BaseModel):
    """Every week on day_of_week (until ends_on, when set), or once on on_date; exactly one of
    day_of_week and on_date (owner decision 2026-11-11)."""

    day_of_week: int | None = Field(default=None, ge=0, le=6, description="0 = Sunday ... 6 = Saturday")
    on_date: date | None = None
    ends_on: date | None = Field(default=None, description="last date of a weekly row")
    # Timetable blocks and booking periods are on working days only.
    _working_days: bool = True

    @model_validator(mode="after")
    def one_when(self):
        if (self.day_of_week is None) == (self.on_date is None):
            raise ValueError("set exactly one of day_of_week and on_date")
        if self.ends_on is not None and self.day_of_week is None:
            raise ValueError("ends_on is only for a weekly row")
        if self._working_days:
            day = self.day_of_week if self.on_date is None else (self.on_date.weekday() + 1) % 7
            if day > 4:
                raise ValueError("must be a working day (Sunday to Thursday)")
        return self


class BlockIn(WhenIn):
    kind: BlockKind = "office_hours"
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


class PeriodIn(WhenIn):
    start_time: QuarterHour
    end_time: QuarterHour

    @field_validator("end_time")
    @classmethod
    def after_start(cls, end: time, info) -> time:
        start = info.data.get("start_time")
        if start is not None and end <= start:
            raise ValueError("must be after start_time")
        return end


class ClosureIn(WhenIn):
    """end_time at or before start_time means the closure runs past midnight
    ("20:00" to "08:00"); equal times close the whole day. Any day of the week."""

    _working_days: bool = False
    start_time: QuarterHour
    end_time: QuarterHour


class SkipIn(BaseModel):
    """A date on which a weekly row does not happen."""

    skip_date: date


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
    # Length in 5-minute steps; without it, the professor's usual length.
    minutes: int | None = Field(default=None, ge=5, le=600, multiple_of=5)
    topic: Topic | None = None
    note: OptionalText200

    def starts_at_utc(self) -> datetime:
        return to_naive_utc(self.starts_at)


class MoveIn(BaseModel):
    """Move an appointment earlier on the same day; its length stays."""

    starts_at: AwareDatetime

    def starts_at_utc(self) -> datetime:
        return to_naive_utc(self.starts_at)


class EarlierStartsOut(BaseModel):
    appointment_id: int
    starts: list[UtcDatetime]


# --- admin -------------------------------------------------------------------


class DepartmentIn(BaseModel):
    college_id: int
    code: str = Field(pattern=r"^[A-Z]{2,10}$")
    name_ar: NameAr
    name_en: NameEn


class DepartmentPatch(BaseModel):
    college_id: int | None = None
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


class AdminProfessorPatch(AccountPatch):
    department_id: int | None = None
    office_id: int | None = None
    honorific: Honorific | None = None
    academic_rank: Rank | None = None


class AdminStudentIn(AccountIn):
    university_no: str = Field(pattern=r"^[A-Z0-9]{4,12}$")
    department_id: int
    study_year: int = Field(default=1, ge=1, le=6)


class AdminStudentPatch(AccountPatch):
    university_no: str | None = Field(default=None, pattern=r"^[A-Z0-9]{4,12}$")
    department_id: int | None = None
    study_year: int | None = Field(default=None, ge=1, le=6)


def _strip_lower(value: object) -> object:
    return value.strip().lower() if isinstance(value, str) else value


class _SignUpBase(AccountIn):
    # Typed emails are forgiven their case and spaces; the stored address is lower case.
    email: Annotated[Email, BeforeValidator(_strip_lower)]
    department_id: int
    # As for sign-in: "native" gets the refresh token in the body, "web" as a cookie.
    client: Literal["native", "web"] = "native"


class StudentSignUpIn(_SignUpBase):
    """A student's university email is <university number>@domain; the number is read from it."""

    role: Literal["student"]
    study_year: int = Field(ge=1, le=6)


class ProfessorSignUpIn(_SignUpBase):
    role: Literal["professor"]
    honorific: Honorific = "dr"
    academic_rank: Rank = "assistant_professor"


SignUpIn = Annotated[StudentSignUpIn | ProfessorSignUpIn, Field(discriminator="role")]


class PendingOut(BaseModel):
    """A professor's sign-up: the account exists but waits for an admin to activate it."""

    pending: Literal[True] = True
    email: str


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


class AdminStudentOut(AccountOut):
    university_no: str
    department: DepartmentOut
    study_year: int


# --- chat and notifications (P5) ---------------------------------------------------


class ParticipantOut(PersonOut):
    role: Literal["student", "professor"]
    honorific: str | None = None  # professors only


class MessageOut(BaseModel):
    message_id: int
    sender_role: Literal["student", "professor"]
    mine: bool
    body: str
    created_at: UtcDatetime
    read_at: UtcDatetime | None


class LastMessageOut(BaseModel):
    body: str
    mine: bool
    created_at: UtcDatetime


class ConversationOut(BaseModel):
    conversation_id: int
    other: ParticipantOut
    last_message: LastMessageOut | None
    unread_count: int
    created_at: UtcDatetime
    # Set while the professor's closed hours are on: students can write again at this time.
    closed_until: UtcDatetime | None = None


class ConversationIn(BaseModel):
    """Students name the professor, professors the student."""

    professor_id: int | None = None
    student_id: int | None = None


class MessageIn(BaseModel):
    body: Annotated[str, AfterValidator(str.strip), Field(min_length=1, max_length=1000)]


class NotificationOut(BaseModel):
    notification_id: int
    type: Literal[
        "appointment_requested",
        "appointment_approved",
        "appointment_declined",
        "appointment_cancelled",
        "appointment_moved",
        "slot_freed",
        "new_message",
    ]
    created_at: UtcDatetime
    read_at: UtcDatetime | None
    appointment_id: int | None
    conversation_id: int | None
    # The other person (who booked, approved, cancelled or wrote) and, for appointments, when.
    actor: ParticipantOut | None
    starts_at: UtcDatetime | None


class UnreadOut(BaseModel):
    notifications: int
    messages: int


class ReadIn(BaseModel):
    """Mark these notifications read; leave out to mark all of them."""

    ids: list[int] | None = Field(default=None, max_length=100)
