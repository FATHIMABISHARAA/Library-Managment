
from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

from .models import Book, Member, Loan


LOAN_DAYS = 14
FINE_PER_DAY = 5
MAX_ACTIVE_LOANS = 3


@transaction.atomic
def issue_book(book_id, member_id):

    # Lock book and member during the transaction
    book = Book.objects.select_for_update().filter(
        id=book_id
    ).first()

    if book is None:
        raise NotFound("Book not found.")

    member = Member.objects.select_for_update().filter(
        id=member_id
    ).first()

    if member is None:
        raise NotFound("Member not found.")

    # Check active loans
    active_count = Loan.objects.filter(
        member=member,
        return_date__isnull=True
    ).count()

    if active_count >= MAX_ACTIVE_LOANS:
        raise ValidationError(
            "Member cannot have more than 3 active loans."
        )

    # Check available copies
    if book.copies_available <= 0:
        raise ValidationError(
            "No copies of this book are available."
        )

    today = timezone.localdate()
    due_date = today + timedelta(days=LOAN_DAYS)

    # Reduce stock
    book.copies_available -= 1
    book.save(update_fields=["copies_available"])

    # Create loan
    loan = Loan.objects.create(
        book=book,
        member=member,
        issue_date=today,
        due_date=due_date
    )

    return loan


@transaction.atomic
def return_book(loan_id):

    loan = Loan.objects.select_for_update().filter(
        id=loan_id
    ).first()

    if loan is None:
        raise NotFound("Loan not found.")

    if loan.return_date is not None:
        raise ValidationError(
            "This book has already been returned."
        )

    book = Book.objects.select_for_update().get(
        id=loan.book_id
    )

    today = timezone.localdate()

    late_days = max(
        (today - loan.due_date).days,
        0
    )

    fine = late_days * FINE_PER_DAY

    # Update loan
    loan.return_date = today
    loan.fine = fine
    loan.save(update_fields=["return_date", "fine"])

    # Restore available stock
    book.copies_available += 1
    book.save(update_fields=["copies_available"])

    return loan


def member_history(member_id):

    member = Member.objects.filter(
        id=member_id
    ).first()

    if member is None:
        raise NotFound("Member not found.")

    return Loan.objects.filter(
        member=member
    ).select_related(
        "book"
    ).order_by("-issue_date", "-id")


def overdue_loans():

    today = timezone.localdate()

    return Loan.objects.filter(
        return_date__isnull=True,
        due_date__lt=today
    ).select_related(
        "book", "member"
    ).order_by("due_date")
