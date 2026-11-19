
from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone

from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Book, Member, Loan


# Serializers

class BookSerializer(serializers.ModelSerializer):
    class Meta:
        model = Book
        fields = "__all__"


class MemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = Member
        fields = "__all__"


class LoanSerializer(serializers.ModelSerializer):
    book_title = serializers.CharField(
        source="book.title",
        read_only=True
    )

    member_name = serializers.CharField(
        source="member.name",
        read_only=True
    )

    class Meta:
        model = Loan
        fields = [
            "id",
            "book",
            "book_title",
            "member",
            "member_name",
            "issue_date",
            "due_date",
            "return_date",
            "fine",
        ]
        read_only_fields = [
            "issue_date",
            "due_date",
            "return_date",
            "fine",
        ]

class IssueBookSerializer(serializers.Serializer):
    book_id = serializers.PrimaryKeyRelatedField(
        queryset=Book.objects.all()
    )

    member_id = serializers.PrimaryKeyRelatedField(
        queryset=Member.objects.all()
    )

# Book ViewSet

class BookViewSet(viewsets.ModelViewSet):
    queryset = Book.objects.all()
    serializer_class = BookSerializer


# Member ViewSet

class MemberViewSet(viewsets.ModelViewSet):
    queryset = Member.objects.all()
    serializer_class = MemberSerializer

    @action(detail=True, methods=["get"])
    def history(self, request, pk=None):
        member = self.get_object()

        loans = Loan.objects.filter(member=member)

        total_fine = loans.aggregate(
            total=Sum("fine")
        )["total"] or Decimal("0.00")

        return Response({
            "member_id": member.id,
            "history": LoanSerializer(
                loans, many=True
            ).data,
            "total_fine": str(total_fine),
            "total_loans": loans.count()
        })


# Loan ViewSet

class LoanViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Loan.objects.select_related(
        "book", "member"
    ).all()

    serializer_class = LoanSerializer

    # Issue a book

    @action(detail=False, methods=["post"])
    def issue(self, request):

        serializer = IssueBookSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        selected_book = serializer.validated_data["book_id"]
        selected_member = serializer.validated_data["member_id"]

        with transaction.atomic():

            book = get_object_or_404(
                Book.objects.select_for_update(),
                id=selected_book.id
            )

            member = selected_member

            if book.copies_available <= 0:
                return Response(
                    {"error": "Book is not available."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            issue_date = timezone.localdate()
            due_date = issue_date + timedelta(days=14)

            loan = Loan.objects.create(
                book=book,
                member=member,
                issue_date=issue_date,
                due_date=due_date
            )

            book.copies_available -= 1
            book.save(update_fields=["copies_available"])

        return Response(
            LoanSerializer(loan).data,
            status=status.HTTP_201_CREATED
        )
    # Return a book

    @action(detail=True, methods=["post"])
    def return_book(self, request, pk=None):

        with transaction.atomic():

            loan = get_object_or_404(
                Loan.objects.select_for_update(),
                pk=pk
            )

            if loan.return_date is not None:
                return Response(
                    {"error": "Book has already been returned."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            return_date = timezone.localdate()

            overdue_days = max(
                0, (return_date - loan.due_date).days
            )

            fine = Decimal(overdue_days) * Decimal("5.00")

            loan.return_date = return_date
            loan.fine = fine
            loan.save(
                update_fields=["return_date", "fine"]
            )

            book = Book.objects.select_for_update().get(
                pk=loan.book_id
            )
            book.copies_available += 1
            book.save(update_fields=["copies_available"])

        return Response({
            "message": "Book returned successfully.",
            "loan": LoanSerializer(loan).data,
            "fine": str(fine)
        })

    # View overdue loans

    @action(detail=False, methods=["get"])
    def overdue(self, request):

        today = timezone.localdate()

        loans = self.get_queryset().filter(
            due_date__lt=today,
            return_date__isnull=True
        )

        return Response(
            LoanSerializer(loans, many=True).data
        )
