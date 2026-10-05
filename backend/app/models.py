"""SQLAlchemy models mapped onto the tables created by db/schema.sql.

db/schema.sql is the source of truth (constraints, triggers, generated columns);
the app never creates tables. tests/test_schema_sync.py checks these models
against the live MySQL schema column by column.
"""

from datetime import datetime, time

from sqlalchemy import Boolean, Computed, DateTime, ForeignKey, ForeignKeyConstraint, Integer, String, Time
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Department(Base):
    __tablename__ = "departments"
    department_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(10))
    name_ar: Mapped[str] = mapped_column(String(100))
    name_en: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default="(UTC_TIMESTAMP())")


class User(Base):
    __tablename__ = "users"
    user_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(254))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(10))
    full_name_ar: Mapped[str] = mapped_column(String(100))
    full_name_en: Mapped[str] = mapped_column(String(100))
    preferred_locale: Mapped[str] = mapped_column(String(2), server_default="ar")
    is_active: Mapped[bool] = mapped_column(Boolean, server_default="1")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default="(UTC_TIMESTAMP())")
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default="(UTC_TIMESTAMP())")


class Office(Base):
    __tablename__ = "offices"
    office_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    building_code: Mapped[str] = mapped_column(String(10))
    floor: Mapped[int] = mapped_column(Integer, server_default="0")
    room_number: Mapped[str] = mapped_column(String(10))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default="(UTC_TIMESTAMP())")


class Student(Base):
    __tablename__ = "students"
    student_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Stored generated constant; part of the composite FK to users (user_id, role).
    role: Mapped[str] = mapped_column(String(10), Computed("'student'", persisted=True))
    university_no: Mapped[str] = mapped_column(String(12))
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.department_id"))
    study_year: Mapped[int] = mapped_column(Integer, server_default="1")
    __table_args__ = (ForeignKeyConstraint(["student_id", "role"], ["users.user_id", "users.role"]),)

    # The composite FK also covers role, so the join is spelled out; writes go through ids.
    user: Mapped[User] = relationship(
        primaryjoin="Student.student_id == foreign(User.user_id)", viewonly=True, lazy="joined"
    )
    department: Mapped[Department] = relationship()


class Professor(Base):
    __tablename__ = "professors"
    professor_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    role: Mapped[str] = mapped_column(String(10), Computed("'professor'", persisted=True))
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.department_id"))
    office_id: Mapped[int | None] = mapped_column(ForeignKey("offices.office_id"))
    honorific: Mapped[str] = mapped_column(String(5), server_default="dr")
    academic_rank: Mapped[str] = mapped_column(String(20), server_default="assistant_professor")
    slot_minutes: Mapped[int] = mapped_column(Integer, server_default="15")
    open_messages: Mapped[bool] = mapped_column(Boolean, server_default="0")
    __table_args__ = (ForeignKeyConstraint(["professor_id", "role"], ["users.user_id", "users.role"]),)

    user: Mapped[User] = relationship(
        primaryjoin="Professor.professor_id == foreign(User.user_id)", viewonly=True, lazy="joined"
    )
    department: Mapped[Department] = relationship()
    office: Mapped[Office | None] = relationship()
    blocks: Mapped[list["ScheduleBlock"]] = relationship(
        order_by=lambda: [ScheduleBlock.day_of_week, ScheduleBlock.start_time], viewonly=True
    )


class ScheduleBlock(Base):
    __tablename__ = "schedule_blocks"
    block_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    professor_id: Mapped[int] = mapped_column(ForeignKey("professors.professor_id"))
    kind: Mapped[str] = mapped_column(String(12), server_default="office_hours")
    day_of_week: Mapped[int] = mapped_column(Integer)
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)
    label: Mapped[str | None] = mapped_column(String(40))


class StatusOverride(Base):
    __tablename__ = "status_overrides"
    override_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    professor_id: Mapped[int] = mapped_column(ForeignKey("professors.professor_id"))
    status: Mapped[str] = mapped_column(String(10))
    note: Mapped[str | None] = mapped_column(String(60))
    created_at: Mapped[datetime] = mapped_column(DateTime)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime)


class Appointment(Base):
    __tablename__ = "appointments"
    appointment_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.student_id"))
    professor_id: Mapped[int] = mapped_column(ForeignKey("professors.professor_id"))
    starts_at: Mapped[datetime] = mapped_column(DateTime)
    ends_at: Mapped[datetime] = mapped_column(DateTime)
    status: Mapped[str] = mapped_column(String(10), server_default="pending")
    topic: Mapped[str | None] = mapped_column(String(12))
    note: Mapped[str | None] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime)
    updated_at: Mapped[datetime] = mapped_column(DateTime)
    # Virtual generated column behind the double-booking unique index.
    active_slot: Mapped[str | None] = mapped_column(
        String(19),
        Computed(
            "CASE WHEN status IN ('pending','approved') THEN CAST(starts_at AS CHAR(19)) END", persisted=False
        ),
    )

    student: Mapped[Student] = relationship()
    professor: Mapped[Professor] = relationship()


class Pin(Base):
    __tablename__ = "pins"
    student_id: Mapped[int] = mapped_column(ForeignKey("students.student_id"), primary_key=True)
    professor_id: Mapped[int] = mapped_column(ForeignKey("professors.professor_id"), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime)


class Conversation(Base):
    __tablename__ = "conversations"
    conversation_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.student_id"))
    professor_id: Mapped[int] = mapped_column(ForeignKey("professors.professor_id"))
    created_at: Mapped[datetime] = mapped_column(DateTime)


class Message(Base):
    __tablename__ = "messages"
    message_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    conversation_id: Mapped[int] = mapped_column(ForeignKey("conversations.conversation_id"))
    sender_role: Mapped[str] = mapped_column(String(10))
    body: Mapped[str] = mapped_column(String(1000))
    created_at: Mapped[datetime] = mapped_column(DateTime)
    read_at: Mapped[datetime | None] = mapped_column(DateTime)


class Notification(Base):
    __tablename__ = "notifications"
    notification_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.user_id"))
    type: Mapped[str] = mapped_column(String(25))
    appointment_id: Mapped[int | None] = mapped_column(ForeignKey("appointments.appointment_id"))
    conversation_id: Mapped[int | None] = mapped_column(ForeignKey("conversations.conversation_id"))
    created_at: Mapped[datetime] = mapped_column(DateTime)
    read_at: Mapped[datetime | None] = mapped_column(DateTime)
