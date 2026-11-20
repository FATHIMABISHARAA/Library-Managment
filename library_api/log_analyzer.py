
import re
from collections import Counter, defaultdict

# Log file path
LOG_FILE = "server.log"

# Match Django request log format
LINE = re.compile(
    r'(?P<ip>[\d.]+) - \[(?P<date>\d{2}/\w+/\d{4}):'
    r'(?P<hour>\d{2}):\d{2}:\d{2}\] '
    r'"(?P<method>\w+) (?P<path>\S+) [^"]+" '
    r'(?P<status>\d{3}) (?P<bytes>\d+) (?P<took>[\d.]+)'
)

def read_lines(filename):
    """Read the log file one line at a time."""
    with open(filename, "r", encoding="utf-8") as file:
        yield from file

def parse_logs(lines, stats):
    """Parse valid log lines and skip malformed lines."""
    for line in lines:
        match = LINE.match(line)

        if not match:
            stats["malformed"] += 1
            continue

        record = match.groupdict()
        record["status"] = int(record["status"])
        record["took"] = float(record["took"])

        yield record

def analyze_logs():
    stats = Counter()
    endpoints = Counter()
    hours = Counter()
    failed_logins = Counter()

    # Memory-efficient response-time calculations
    time_sum = defaultdict(float)
    time_count = Counter()

    for record in parse_logs(read_lines(LOG_FILE), stats):
        stats["total"] += 1

        if record["status"] >= 500:
            stats["errors"] += 1

        endpoints[record["path"]] += 1
        hours[record["hour"]] += 1

        time_sum[record["path"]] += record["took"]
        time_count[record["path"]] += 1

        if record["path"] == "/login" and record["status"] == 401:
            failed_logins[record["ip"]] += 1

    # Report
    print("\n===== LIBRARY MANAGEMENT SYSTEM LOG REPORT =====")

    total = stats["total"]
    error_rate = (stats["errors"] / total * 100) if total else 0

    print(f"\nTotal requests: {total}")
    print(f"Malformed lines: {stats['malformed']}")
    print(f"Server errors: {stats['errors']}")
    print(f"Error rate: {error_rate:.2f}%")

    print("\nTop 5 endpoints:")
    for path, count in endpoints.most_common(5):
        print(f"{path}: {count} requests")

    print("\nSlowest endpoints (average response time):")
    averages = [
        (path, time_sum[path] / time_count[path])
        for path in time_sum
    ]

    for path, average in sorted(
        averages, key=lambda item: item[1], reverse=True
    )[:5]:
        print(f"{path}: {average:.4f} seconds")

    print("\nRequests per hour:")
    for hour in sorted(hours):
        print(f"{hour}:00 - {hours[hour]} requests")

    suspicious = {
        ip: count
        for ip, count in failed_logins.items()
        if count > 20
    }

    print("\nSuspicious IPs (more than 20 failed logins):")
    print(suspicious if suspicious else "No suspicious IPs found.")

if __name__ == "__main__":
    analyze_logs()
