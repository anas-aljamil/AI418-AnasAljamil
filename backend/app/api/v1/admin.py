"""Admin CRUD for departments, offices, professors and students.

Deleting an account removes the user row; the database cascades to the
profile and everything it owns. Deactivating (is_active = false) keeps history
and blocks sign-in. Deleting a department that still has people returns 409
(ON DELETE RESTRICT); deleting an office leaves its professors without one
(ON DELETE SET NULL).
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.arabic import matches
from app.core.clock import Clock, get_clock
from app.core.errors import not_found
from app.core.pagination import Page, PageParams, page_params, paginate
from app.core.security import hash_password
from app.db import get_db
from app.deps import current_admin
from app.models import Department, Office, Professor, Student, User
from app.schemas import (
    AccountPatch,
    AdminProfessorIn,
    AdminProfessorOut,
    AdminProfessorPatch,
    AdminStudentIn,
    AdminStudentOut,
    AdminStudentPatch,
    DepartmentIn,
    DepartmentOut,
    DepartmentPatch,
    OfficeIn,
    OfficeOut,
    OfficePatch,
)
from app.services import accounts

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(current_admin)])
Search = Annotated[str | None, Query(max_length=100)]

ACCOUNT_FIELDS = {"email", "password", "full_name_ar", "full_name_en", "preferred_locale", "is_active"}


def _get[T](db: Session, model: type[T], key: int, label: str) -> T:
    row = db.get(model, key)
    if row is None:
        raise not_found(label)
    return row


def _apply_account_patch(db: Session, user: User, body: AccountPatch, now) -> None:
    changes = body.model_dump(exclude_unset=True, include=ACCOUNT_FIELDS)
    if "email" in changes:
        accounts.ensure_email_free(db, changes["email"], user.user_id)
    if "password" in changes:
        user.password_hash = hash_password(changes.pop("password"))
    for field, value in changes.items():
        setattr(user, field, value)
    user.updated_at = now


# --- departments --------------------------------------------------------------


@router.get("/departments", response_model=Page[DepartmentOut])
def list_departments(
    page: PageParams = Depends(page_params), db: Session = Depends(get_db)
) -> Page[DepartmentOut]:
    return paginate(
        [DepartmentOut.model_validate(d) for d in db.scalars(select(Department).order_by(Department.code))],
        page,
    )


@router.post("/departments", response_model=DepartmentOut, status_code=201)
def create_department(
    body: DepartmentIn, db: Session = Depends(get_db), clock: Clock = Depends(get_clock)
) -> DepartmentOut:
    accounts.ensure_college_exists(db, body.college_id)
    department = Department(**body.model_dump(), created_at=clock.now())
    db.add(department)
    db.commit()
    db.refresh(department)
    return DepartmentOut.model_validate(department)


@router.patch("/departments/{department_id}", response_model=DepartmentOut)
def update_department(
    department_id: int, body: DepartmentPatch, db: Session = Depends(get_db)
) -> DepartmentOut:
    department = _get(db, Department, department_id, "Department")
    changes = body.model_dump(exclude_unset=True)
    accounts.ensure_college_exists(db, changes.get("college_id"))
    for field, value in changes.items():
        setattr(department, field, value)
    db.commit()
    db.refresh(department)  # reloads the college when it changed
    return DepartmentOut.model_validate(department)


@router.delete("/departments/{department_id}", status_code=204)
def delete_department(department_id: int, db: Session = Depends(get_db)) -> Response:
    db.delete(_get(db, Department, department_id, "Department"))
    db.commit()  # 409 IN_USE (MySQL 1451) while professors or students belong to it
    return Response(status_code=204)


# --- offices ------------------------------------------------------------------


@router.get("/offices", response_model=Page[OfficeOut])
def list_offices(page: PageParams = Depends(page_params), db: Session = Depends(get_db)) -> Page[OfficeOut]:
    rows = db.scalars(select(Office).order_by(Office.building_code, Office.room_number))
    return paginate([OfficeOut.model_validate(o) for o in rows], page)


@router.post("/offices", response_model=OfficeOut, status_code=201)
def create_office(
    body: OfficeIn, db: Session = Depends(get_db), clock: Clock = Depends(get_clock)
) -> OfficeOut:
    office = Office(**body.model_dump(), created_at=clock.now())
    db.add(office)
    db.commit()
    return OfficeOut.model_validate(office)


@router.patch("/offices/{office_id}", response_model=OfficeOut)
def update_office(office_id: int, body: OfficePatch, db: Session = Depends(get_db)) -> OfficeOut:
    office = _get(db, Office, office_id, "Office")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(office, field, value)
    db.commit()
    return OfficeOut.model_validate(office)


@router.delete("/offices/{office_id}", status_code=204)
def delete_office(office_id: int, db: Session = Depends(get_db)) -> Response:
    db.delete(_get(db, Office, office_id, "Office"))
    db.commit()
    return Response(status_code=204)


# --- professors ---------------------------------------------------------------


def professor_out(professor: Professor) -> AdminProfessorOut:
    user = professor.user
    return AdminProfessorOut(
        user_id=user.user_id,
        email=user.email,
        full_name_ar=user.full_name_ar,
        full_name_en=user.full_name_en,
        preferred_locale=user.preferred_locale,
        is_active=user.is_active,
        created_at=user.created_at,
        department=DepartmentOut.model_validate(professor.department),
        office=OfficeOut.model_validate(professor.office) if professor.office else None,
        honorific=professor.honorific,
        academic_rank=professor.academic_rank,
        slot_minutes=professor.slot_minutes,
        open_messages=professor.open_messages,
    )


@router.get("/professors", response_model=Page[AdminProfessorOut])
def list_professors(
    q: Search = None, page: PageParams = Depends(page_params), db: Session = Depends(get_db)
) -> Page[AdminProfessorOut]:
    rows = [
        p
        for p in db.scalars(select(Professor).order_by(Professor.professor_id))
        if not q or matches(q, p.user.full_name_ar, p.user.full_name_en, p.user.email)
    ]
    return paginate([professor_out(p) for p in rows], page)


@router.post("/professors", response_model=AdminProfessorOut, status_code=201)
def create_professor(
    body: AdminProfessorIn, db: Session = Depends(get_db), clock: Clock = Depends(get_clock)
) -> AdminProfessorOut:
    accounts.ensure_exists(db, body.department_id, body.office_id)
    user = accounts.create_user(db, body, "professor", clock.now())
    professor = Professor(
        professor_id=user.user_id,
        department_id=body.department_id,
        office_id=body.office_id,
        honorific=body.honorific,
        academic_rank=body.academic_rank,
        slot_minutes=body.slot_minutes,
        open_messages=body.open_messages,
    )
    db.add(professor)
    db.commit()
    return professor_out(professor)


@router.patch("/professors/{professor_id}", response_model=AdminProfessorOut)
def update_professor(
    professor_id: int,
    body: AdminProfessorPatch,
    db: Session = Depends(get_db),
    clock: Clock = Depends(get_clock),
) -> AdminProfessorOut:
    professor = _get(db, Professor, professor_id, "Professor")
    _apply_account_patch(db, professor.user, body, clock.now())
    changes = body.model_dump(exclude_unset=True, exclude=ACCOUNT_FIELDS)
    accounts.ensure_exists(db, changes.get("department_id"), changes.get("office_id"))
    for field, value in changes.items():
        setattr(professor, field, value)
    db.commit()
    db.refresh(professor)
    return professor_out(professor)


@router.delete("/professors/{professor_id}", status_code=204)
def delete_professor(professor_id: int, db: Session = Depends(get_db)) -> Response:
    _get(db, Professor, professor_id, "Professor")
    db.delete(db.get(User, professor_id))  # cascades to the profile, schedule, bookings, chats
    db.commit()
    return Response(status_code=204)


# --- students -----------------------------------------------------------------


def student_out(student: Student) -> AdminStudentOut:
    user = student.user
    return AdminStudentOut(
        user_id=user.user_id,
        email=user.email,
        full_name_ar=user.full_name_ar,
        full_name_en=user.full_name_en,
        preferred_locale=user.preferred_locale,
        is_active=user.is_active,
        created_at=user.created_at,
        university_no=student.university_no,
        department=DepartmentOut.model_validate(student.department),
        study_year=student.study_year,
    )


@router.get("/students", response_model=Page[AdminStudentOut])
def list_students(
    q: Search = None, page: PageParams = Depends(page_params), db: Session = Depends(get_db)
) -> Page[AdminStudentOut]:
    rows = [
        s
        for s in db.scalars(select(Student).order_by(Student.student_id))
        if not q or matches(q, s.user.full_name_ar, s.user.full_name_en, s.user.email, s.university_no)
    ]
    return paginate([student_out(s) for s in rows], page)


@router.post("/students", response_model=AdminStudentOut, status_code=201)
def create_student(
    body: AdminStudentIn, db: Session = Depends(get_db), clock: Clock = Depends(get_clock)
) -> AdminStudentOut:
    accounts.ensure_exists(db, body.department_id)
    accounts.ensure_university_no_free(db, body.university_no)
    user = accounts.create_user(db, body, "student", clock.now())
    student = Student(
        student_id=user.user_id,
        university_no=body.university_no,
        department_id=body.department_id,
        study_year=body.study_year,
    )
    db.add(student)
    db.commit()
    return student_out(student)


@router.patch("/students/{student_id}", response_model=AdminStudentOut)
def update_student(
    student_id: int, body: AdminStudentPatch, db: Session = Depends(get_db), clock: Clock = Depends(get_clock)
) -> AdminStudentOut:
    student = _get(db, Student, student_id, "Student")
    _apply_account_patch(db, student.user, body, clock.now())
    changes = body.model_dump(exclude_unset=True, exclude=ACCOUNT_FIELDS)
    accounts.ensure_exists(db, changes.get("department_id"))
    for field, value in changes.items():
        setattr(student, field, value)
    db.commit()
    db.refresh(student)
    return student_out(student)


@router.delete("/students/{student_id}", status_code=204)
def delete_student(student_id: int, db: Session = Depends(get_db)) -> Response:
    _get(db, Student, student_id, "Student")
    db.delete(db.get(User, student_id))
    db.commit()
    return Response(status_code=204)
