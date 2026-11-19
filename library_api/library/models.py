
from django.db import models
from django.utils import timezone


class Book(models.Model):
    title = models.CharField(max_length=200)
    author = models.CharField(max_length=150)
    copies_available = models.PositiveIntegerField(default=1)

    def __str__(self):
        return self.title


class Member(models.Model):
    name = models.CharField(max_length=150)
    email = models.EmailField(unique=True)

    def __str__(self):
        return self.name


class Loan(models.Model):
    book = models.ForeignKey(
        Book,
        on_delete=models.PROTECT,
        related_name="loans"
    )

    member = models.ForeignKey(
        Member,
        on_delete=models.PROTECT,
        related_name="loans"
    )

    issue_date = models.DateField(default=timezone.localdate)
    due_date = models.DateField()
    return_date = models.DateField(null=True, blank=True)
    fine = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0
    )

    def __str__(self):
        return f"{self.member.name} - {self.book.title}"

    @property
    def is_active(self):
        return self.return_date is None
