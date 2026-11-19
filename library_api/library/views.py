
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import authenticate, get_user_model
from django.db import transaction
from django.db.models import Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone

from rest_framework import serializers, status, viewsets
from rest_framework.authentication import TokenAuthentication
from rest_framework.authtoken.models import Token
from rest_framework.decorators import action
from rest_framework.permissions import (
    AllowAny,
    IsAdminUser,
    IsAuthenticated,
    IsAuthenticatedOrReadOnly,
    BasePermission,
)
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Book, Member, Loan, FinePayment


User = get_user_model()


# --------------------------------------------------
# PERMISSIONS
# --------------------------------------------------

class IsAdminOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return True
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_staff
        )


# --------------------------------------------------
# SERIALIZERS
# --------------------------------------------------

class BookSerializer(serializers.ModelSerializer):
    class Meta:
        model = Book
        fields = "__all__"


class MemberSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        required=False,
        min_length=8
    )

    class Meta:
        model = Member
        fields = ["id", "name", "email", "user", "password"]
        read_only_fields = ["id", "user"]

    def create(self, validated_data):
        password = validated_data.pop("password", None)

        with transaction.atomic():
            member = Member.objects.create(**validated_data)

            if password:
                user = User.objects.create_user(
                    username=member.email,
                    email=member.email,
                    password=password,
                    first_name=member.name
                )
                member.user = user
                member.save(update_fields=["user"])

        return member

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)

        for field, value in validated_data.items():
            setattr(instance, field, value)

        instance.save()

        if password and instance.user:
            instance.user.set_password(password)
            instance.user.save(update_fields=["password"])

        return instance


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
    # Only admins may use this field.
    member_id = serializers.PrimaryKeyRelatedField(
        queryset=Member.objects.all(),
        required=False
    )


class RegistrationSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(
        min_length=8,
        write_only=True
    )

    def validate_email(self, value):
        value = value.strip().lower()

        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError(
                "An account with this email already exists."
            )

        existing_member = Member.objects.filter(
            email__iexact=value
        ).first()

        if existing_member and existing_member.user_id:
            raise serializers.ValidationError(
                "This member already has a login account."
            )

        return value


class FinePaymentSerializer(serializers.ModelSerializer):
    book_title = serializers.CharField(
        source="loan.book.title",
        read_only=True
    )
    status_display = serializers.CharField(
        source="get_status_display",
        read_only=True
    )

    class Meta:
        model = FinePayment
        fields = [
            "id",
            "loan",
            "book_title",
            "amount",
            "status",
            "status_display",
            "payment_method",
            "transaction_reference",
            "created_at",
            "paid_at",
        ]
        read_only_fields = [
            "id",
            "loan",
            "amount",
            "status",
            "transaction_reference",
            "created_at",
            "paid_at",
        ]


# --------------------------------------------------
# REGISTRATION
# --------------------------------------------------

class RegisterView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = RegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data

        with transaction.atomic():
            # Reuse an existing unlinked member record if its
            # email matches; otherwise create a new member.
            member = Member.objects.filter(
                email__iexact=data["email"],
                user__isnull=True
            ).first()

            if member:
                member.name = data["name"]
                member.email = data["email"]
                member.save(update_fields=["name", "email"])
            else:
                member = Member.objects.create(
                    name=data["name"],
                    email=data["email"]
                )

            user = User.objects.create_user(
                username=data["email"],
                email=data["email"],
                password=data["password"],
                first_name=data["name"]
            )

            member.user = user
            member.save(update_fields=["user"])

            token, _ = Token.objects.get_or_create(user=user)

        return Response({
            "message": "Registration successful.",
            "token": token.key,
            "role": "member",
            "member_id": member.id,
            "name": member.name,
            "email": member.email,
        }, status=status.HTTP_201_CREATED)


# --------------------------------------------------
# LOGIN
# --------------------------------------------------

class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        email = request.data.get("email", "").strip().lower()
        password = request.data.get("password", "")

        if not email or not password:
            return Response(
                {"error": "Email and password are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        user_record = User.objects.filter(
            email__iexact=email
        ).first()

        if not user_record:
            return Response(
                {"error": "Invalid email or password."},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = authenticate(
            request,
            username=user_record.get_username(),
            password=password
        )

        if user is None:
            return Response(
                {"error": "Invalid email or password."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if user.is_staff or user.is_superuser:
            role = "admin"
            member_id = None
            name = user.get_full_name() or user.username
        else:
            try:
                member = user.library_member
            except Member.DoesNotExist:
                return Response(
                    {"error": "No library member profile is linked to this account."},
                    status=status.HTTP_403_FORBIDDEN
                )

            role = "member"
            member_id = member.id
            name = member.name

        token, _ = Token.objects.get_or_create(user=user)

        return Response({
            "message": "Login successful.",
            "token": token.key,
            "role": role,
            "member_id": member_id,
            "name": name,
            "email": user.email,
        })


# --------------------------------------------------
# LOGOUT
# --------------------------------------------------

class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        request.user.auth_token.delete()

        return Response({
            "message": "Logged out successfully."
        })


# --------------------------------------------------
# BOOK VIEWSET
# --------------------------------------------------

class BookViewSet(viewsets.ModelViewSet):
    queryset = Book.objects.all().order_by("title")
    serializer_class = BookSerializer
    permission_classes = [IsAdminOrReadOnly]


# --------------------------------------------------
# MEMBER VIEWSET - ADMIN ONLY
# --------------------------------------------------

class MemberViewSet(viewsets.ModelViewSet):
    queryset = Member.objects.all().order_by("name")
    serializer_class = MemberSerializer
    permission_classes = [IsAdminUser]

    @action(detail=True, methods=["get"])
    def history(self, request, pk=None):
        member = self.get_object()
        loans = Loan.objects.filter(
            member=member
        ).select_related("book").order_by("-issue_date")

        total_fine = loans.aggregate(
            total=Sum("fine")
        )["total"] or Decimal("0.00")

        return Response({
            "member_id": member.id,
            "history": LoanSerializer(loans, many=True).data,
            "total_fine": str(total_fine),
            "total_loans": loans.count()
        })


# --------------------------------------------------
# LOAN VIEWSET
# --------------------------------------------------

class LoanViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = LoanSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Loan.objects.select_related(
            "book", "member"
        ).order_by("-issue_date")

        if self.request.user.is_staff or self.request.user.is_superuser:
            return queryset

        try:
            member = self.request.user.library_member
        except Member.DoesNotExist:
            return queryset.none()

        return queryset.filter(member=member)

    # ----------------------------------------------
    # ISSUE BOOK
    # POST /api/loans/issue/
    # ----------------------------------------------

    @action(detail=False, methods=["post"])
    def issue(self, request):
        serializer = IssueBookSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        selected_book = serializer.validated_data["book_id"]

        is_admin = (
            request.user.is_staff or request.user.is_superuser
        )

        if is_admin:
            selected_member = serializer.validated_data.get(
                "member_id"
            )

            if selected_member is None:
                return Response(
                    {"error": "Admin must provide member_id."},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            if "member_id" in request.data:
                return Response(
                    {"error": "Members cannot select another member."},
                    status=status.HTTP_403_FORBIDDEN
                )

            try:
                selected_member = request.user.library_member
            except Member.DoesNotExist:
                return Response(
                    {"error": "Member profile not found."},
                    status=status.HTTP_403_FORBIDDEN
                )

        with transaction.atomic():
            member = get_object_or_404(
                Member.objects.select_for_update(),
                pk=selected_member.pk
            )

            book = get_object_or_404(
                Book.objects.select_for_update(),
                pk=selected_book.pk
            )

            active_loans = Loan.objects.filter(
                member=member,
                return_date__isnull=True
            ).count()

            if active_loans >= 3:
                return Response(
                    {"error": "You can borrow a maximum of 3 books at a time."},
                    status=status.HTTP_400_BAD_REQUEST
                )

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

    # ----------------------------------------------
    # RETURN BOOK - ADMIN ONLY
    # POST /api/loans/{id}/return_book/
    # ----------------------------------------------

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[IsAdminUser]
    )
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

            book = get_object_or_404(
                Book.objects.select_for_update(),
                pk=loan.book_id
            )

            return_date = timezone.localdate()
            overdue_days = max(
                0, (return_date - loan.due_date).days
            )
            fine = Decimal(overdue_days) * Decimal("5.00")

            loan.return_date = return_date
            loan.fine = fine
            loan.save(update_fields=["return_date", "fine"])

            book.copies_available += 1
            book.save(update_fields=["copies_available"])

        return Response({
            "message": "Book returned successfully.",
            "loan": LoanSerializer(loan).data,
            "fine": str(fine)
        })

    # ----------------------------------------------
    # OVERDUE BOOKS - ADMIN ONLY
    # GET /api/loans/overdue/
    # ----------------------------------------------

    @action(
        detail=False,
        methods=["get"],
        permission_classes=[IsAdminUser]
    )
    def overdue(self, request):
        today = timezone.localdate()

        loans = self.get_queryset().filter(
            due_date__lt=today,
            return_date__isnull=True
        )

        return Response(
            LoanSerializer(loans, many=True).data
        )

    # ----------------------------------------------
    # MEMBER'S OWN LOAN HISTORY
    # GET /api/loans/my_loans/
    # ----------------------------------------------

    @action(detail=False, methods=["get"])
    def my_loans(self, request):
        if request.user.is_staff or request.user.is_superuser:
            return Response(
                {"error": "This endpoint is for members only."},
                status=status.HTTP_403_FORBIDDEN
            )

        loans = self.get_queryset().order_by("-issue_date")

        return Response(
            LoanSerializer(loans, many=True).data
        )

    # ----------------------------------------------
    # MEMBER'S FINE AND PAYMENT SUMMARY
    # GET /api/loans/my_fines/
    # ----------------------------------------------

    @action(detail=False, methods=["get"])
    def my_fines(self, request):
        if request.user.is_staff or request.user.is_superuser:
            return Response(
                {"error": "This endpoint is for members only."},
                status=status.HTTP_403_FORBIDDEN
            )

        loans = self.get_queryset()

        total_fine = loans.aggregate(
            total=Sum("fine")
        )["total"] or Decimal("0.00")

        payments = FinePayment.objects.filter(
            loan__in=loans
        ).order_by("-created_at")

        paid_amount = payments.filter(
            status="PAID"
        ).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")

        pending_amount = payments.filter(
            status="PENDING"
        ).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")

        outstanding = max(
            Decimal("0.00"),
            total_fine - paid_amount - pending_amount
        )

        return Response({
            "total_fine": str(total_fine),
            "paid_amount": str(paid_amount),
            "pending_amount": str(pending_amount),
            "outstanding_amount": str(outstanding),
            "payments": FinePaymentSerializer(
                payments, many=True
            ).data
        })

    # ----------------------------------------------
    # CREATE A FINE PAYMENT REQUEST
    # POST /api/loans/pay_fine/
    # ----------------------------------------------

    @action(detail=False, methods=["post"])
    def pay_fine(self, request):
        if request.user.is_staff or request.user.is_superuser:
            return Response(
                {"error": "This endpoint is for members only."},
                status=status.HTTP_403_FORBIDDEN
            )

        loan_id = request.data.get("loan_id")
        payment_method = request.data.get("payment_method", "CASH")

        if payment_method not in ("CASH", "ONLINE"):
            return Response(
                {"error": "Invalid payment method."},
                status=status.HTTP_400_BAD_REQUEST
            )

        loan = get_object_or_404(
            self.get_queryset(),
            pk=loan_id
        )

        if loan.return_date is None:
            return Response(
                {"error": "Fine payment is available after the book is returned."},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            loan = get_object_or_404(
                Loan.objects.select_for_update(),
                pk=loan.pk
            )

            paid = FinePayment.objects.filter(
                loan=loan,
                status="PAID"
            ).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")

            pending = FinePayment.objects.filter(
                loan=loan,
                status="PENDING"
            ).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")

            outstanding = loan.fine - paid - pending

            if outstanding <= Decimal("0.00"):
                return Response(
                    {"error": "There is no outstanding fine to pay."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            amount = request.data.get("amount", str(outstanding))

            try:
                amount = Decimal(str(amount))
            except Exception:
                return Response(
                    {"error": "Enter a valid payment amount."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if not amount.is_finite() or amount <= Decimal("0.00"):
                return Response(
                    {"error": "Payment amount must be greater than zero."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if amount > outstanding:
                return Response(
                    {"error": "Payment cannot exceed the outstanding fine."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            payment = FinePayment.objects.create(
                loan=loan,
                amount=amount,
                payment_method=payment_method,
                status="PENDING"
            )

        return Response({
            "message": "Payment request created. It will remain pending until verified.",
            "payment": FinePaymentSerializer(payment).data
        }, status=status.HTTP_201_CREATED)

    # ----------------------------------------------
    # ADMIN CONFIRMS A PAYMENT
    # POST /api/loans/{id}/confirm_payment/{payment_id}/
    # ----------------------------------------------

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[IsAdminUser],
        url_path="confirm_payment/(?P<payment_id>[^/.]+)"
    )
    def confirm_payment(self, request, pk=None, payment_id=None):
        with transaction.atomic():
            loan = get_object_or_404(
                Loan.objects.select_for_update(),
                pk=pk
            )

            payment = get_object_or_404(
                FinePayment.objects.select_for_update(),
                pk=payment_id,
                loan=loan
            )

            if payment.status == "PAID":
                return Response(
                    {"error": "This payment has already been confirmed."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            paid_before = FinePayment.objects.filter(
                loan=loan,
                status="PAID"
            ).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")

            if paid_before + payment.amount > loan.fine:
                return Response(
                    {"error": "Confirmed payments cannot exceed the fine amount."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            payment.status = "PAID"
            payment.paid_at = timezone.now()
            payment.save(update_fields=["status", "paid_at"])

        return Response({
            "message": "Payment confirmed successfully.",
            "payment": FinePaymentSerializer(payment).data
        })
