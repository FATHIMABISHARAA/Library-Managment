from dataclasses import dataclass
@dataclass
class Book:
    id: int
    title: str
    author: str
    copies_available: int

def member_history(self, member_id):
    with self.connect() as conn:
        member = conn.execute(
            "SELECT id, name, email FROM members WHERE id = ?",
            (member_id,)
        ).fetchone()

        if member is None:
            raise MemberNotFoundError("Member not found.")

        history = conn.execute(
            """
            SELECT
                loans.id,
                books.title,
                loans.issue_date,
                loans.due_date,
                loans.return_date,
                loans.fine
            FROM loans
            JOIN books ON books.id = loans.book_id
            WHERE loans.member_id = ?
            ORDER BY loans.issue_date DESC
            """,
            (member_id,)
        ).fetchall()

        return {
            "member": {
                "id": member[0],
                "name": member[1],
                "email": member[2]
            },
            "history": history
        }

def search(self, keyword):
    keyword = f"%{keyword}%"

    with self.connect() as conn:
        rows = conn.execute(
            """
            SELECT id, title, author, copies_available
            FROM books
            WHERE title LIKE ? OR author LIKE ?
            ORDER BY title
            """,
            (keyword, keyword)
        ).fetchall()

        return [
            Book(
                id=row[0],
                title=row[1],
                author=row[2],
                copies_available=row[3]
            )
            for row in rows
        ]