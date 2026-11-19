
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    BookViewSet,
    MemberViewSet,
    LoanViewSet,
    RegisterView,
    LoginView,
    LogoutView,
)

router = DefaultRouter()

router.register("books", BookViewSet, basename="book")
router.register("members", MemberViewSet, basename="member")
router.register("loans", LoanViewSet, basename="loan")

urlpatterns = [
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/logout/", LogoutView.as_view(), name="logout"),
    path("", include(router.urls)),
]
