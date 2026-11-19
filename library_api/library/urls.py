
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import BookViewSet, MemberViewSet, LoanViewSet

router = DefaultRouter()

router.register('books', BookViewSet)
router.register('members', MemberViewSet)
router.register('loans', LoanViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
