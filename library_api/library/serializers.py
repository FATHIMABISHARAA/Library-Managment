
from rest_framework import serializers

from .models import Book, Member, Loan


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

    book_id = serializers.IntegerField(min_value=1)
    member_id = serializers.IntegerField(min_value=1)
