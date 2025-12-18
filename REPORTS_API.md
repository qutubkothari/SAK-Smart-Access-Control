# Reports API Documentation

Comprehensive reporting endpoints for access control, visitor management, and attendance analytics.

---

## Table of Contents

1. [Department Access Report](#1-department-access-report)
2. [Visitor Access Report](#2-visitor-access-report)
3. [Attendance Dashboard](#3-attendance-dashboard)

---

## 1. Department Access Report

Get comprehensive access control statistics aggregated by department.

### Endpoint

```
GET /api/v1/reports/access/department
```

### Authorization

- **Roles**: `admin`, `security`

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `start_date` | string (YYYY-MM-DD) | Yes | Report start date |
| `end_date` | string (YYYY-MM-DD) | Yes | Report end date |
| `department_id` | integer | No | Filter by specific department |

### Response

```json
{
  "success": true,
  "message": "Department access report generated successfully",
  "data": {
    "date_range": {
      "start_date": "2025-12-01",
      "end_date": "2025-12-15"
    },
    "departments": [
      {
        "department_id": 1,
        "department_name": "Engineering",
        "statistics": {
          "unique_employees": 45,
          "total_entries": 2340,
          "total_days": 15,
          "avg_entries_per_day": 156.00,
          "avg_entry_hour": 9.3,
          "denied_attempts": 12
        },
        "floor_distribution": [
          {
            "floor_number": 3,
            "access_count": 1850
          },
          {
            "floor_number": 4,
            "access_count": 490
          }
        ],
        "peak_hours": [
          {
            "hour": 9,
            "entry_count": 450
          },
          {
            "hour": 14,
            "entry_count": 280
          },
          {
            "hour": 10,
            "entry_count": 230
          }
        ]
      }
    ],
    "summary": {
      "total_departments": 5,
      "total_entries": 8950,
      "total_denied": 45
    }
  }
}
```

### Use Cases

- **Security Analysis**: Identify departments with unusual access patterns
- **Space Planning**: Understand which floors are most accessed by each department
- **Peak Time Management**: Optimize elevator and entrance schedules based on peak hours
- **Access Violations**: Monitor denied access attempts by department

### Example Request

```bash
curl -X GET "https://sac.saksolution.com/api/v1/reports/access/department?start_date=2025-12-01&end_date=2025-12-15" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Example Request (Specific Department)

```bash
curl -X GET "https://sac.saksolution.com/api/v1/reports/access/department?start_date=2025-12-01&end_date=2025-12-15&department_id=1" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 2. Visitor Access Report

Get detailed visitor access statistics with host and floor distribution.

### Endpoint

```
GET /api/v1/reports/access/visitor
```

### Authorization

- **Roles**: `admin`, `security`, `receptionist`

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `start_date` | string (YYYY-MM-DD) | Yes | Report start date |
| `end_date` | string (YYYY-MM-DD) | Yes | Report end date |
| `host_id` | integer | No | Filter by specific host employee |

### Response

```json
{
  "success": true,
  "message": "Visitor access report generated successfully",
  "data": {
    "date_range": {
      "start_date": "2025-12-01",
      "end_date": "2025-12-15"
    },
    "visitors": [
      {
        "visitor_name": "John Smith",
        "visitor_company": "Tech Solutions Inc.",
        "visitor_phone": "+1234567890",
        "host_name": "Alice Johnson",
        "total_accesses": 15,
        "first_access": "2025-12-05T09:30:00Z",
        "last_access": "2025-12-05T16:45:00Z"
      }
    ],
    "floor_distribution": [
      {
        "floor_number": 1,
        "access_count": 250,
        "unique_visitors": 85
      },
      {
        "floor_number": 2,
        "access_count": 180,
        "unique_visitors": 65
      }
    ],
    "host_statistics": [
      {
        "host_id": 15,
        "host_name": "Alice Johnson",
        "department_name": "Sales",
        "unique_visitors": 12,
        "total_accesses": 145
      }
    ],
    "daily_trend": [
      {
        "date": "2025-12-01",
        "unique_visitors": 18,
        "total_accesses": 142
      },
      {
        "date": "2025-12-02",
        "unique_visitors": 22,
        "total_accesses": 178
      }
    ],
    "summary": {
      "total_visitors": 125,
      "total_accesses": 1850,
      "avg_accesses_per_visitor": 14.80
    }
  }
}
```

### Use Cases

- **Visitor Management**: Track visitor activity and frequency
- **Security Monitoring**: Identify visitors with unusual access patterns
- **Host Performance**: Evaluate which employees host the most visitors
- **Floor Security**: Monitor which floors are accessed by visitors
- **Trend Analysis**: Understand visitor traffic patterns over time

### Example Request

```bash
curl -X GET "https://sac.saksolution.com/api/v1/reports/access/visitor?start_date=2025-12-01&end_date=2025-12-15" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Example Request (Specific Host)

```bash
curl -X GET "https://sac.saksolution.com/api/v1/reports/access/visitor?start_date=2025-12-01&end_date=2025-12-15&host_id=15" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 3. Attendance Dashboard

Get comprehensive attendance analytics with charts data and performance metrics.

### Endpoint

```
GET /api/v1/reports/attendance/dashboard
```

### Authorization

- **Roles**: `admin`, `secretary`

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `start_date` | string (YYYY-MM-DD) | Yes | Dashboard start date |
| `end_date` | string (YYYY-MM-DD) | Yes | Dashboard end date |
| `department_id` | integer | No | Filter by specific department |

### Response

```json
{
  "success": true,
  "message": "Attendance dashboard data retrieved successfully",
  "data": {
    "date_range": {
      "start_date": "2025-12-01",
      "end_date": "2025-12-15"
    },
    "overall_statistics": {
      "total_employees": 150,
      "total_records": 2250,
      "present_count": 1850,
      "late_count": 180,
      "absent_count": 120,
      "half_day_count": 35,
      "leave_count": 45,
      "weekend_count": 15,
      "holiday_count": 5,
      "avg_work_hours": 8.35,
      "attendance_percentage": 92.73
    },
    "department_statistics": [
      {
        "department_id": 1,
        "department_name": "Engineering",
        "employee_count": 45,
        "present_count": 580,
        "late_count": 45,
        "absent_count": 30,
        "avg_work_hours": 8.65,
        "attendance_percentage": 95.42
      }
    ],
    "daily_trend": [
      {
        "date": "2025-12-01",
        "present": 135,
        "late": 8,
        "absent": 7,
        "half_day": 2,
        "leave": 3
      },
      {
        "date": "2025-12-02",
        "present": 142,
        "late": 5,
        "absent": 3,
        "half_day": 1,
        "leave": 4
      }
    ],
    "late_arrival_distribution": [
      {
        "hour": 9,
        "count": 45
      },
      {
        "hour": 10,
        "count": 82
      },
      {
        "hour": 11,
        "count": 38
      }
    ],
    "top_performers": [
      {
        "user_id": 25,
        "full_name": "Alice Johnson",
        "department_name": "Sales",
        "total_days": 15,
        "present_days": 15,
        "attendance_percentage": 100.00,
        "avg_work_hours": 8.95
      },
      {
        "user_id": 42,
        "full_name": "Bob Smith",
        "department_name": "Engineering",
        "total_days": 15,
        "present_days": 15,
        "attendance_percentage": 100.00,
        "avg_work_hours": 9.12
      }
    ]
  }
}
```

### Dashboard Visualizations

#### 1. Attendance Overview (Pie Chart)
```json
{
  "present": 1850,
  "late": 180,
  "absent": 120,
  "half_day": 35,
  "leave": 45
}
```

#### 2. Daily Attendance Trend (Line Chart)
Use `daily_trend` array with dates on X-axis and status counts on Y-axis.

#### 3. Department Comparison (Bar Chart)
Use `department_statistics` array to compare attendance percentages across departments.

#### 4. Late Arrival Pattern (Bar Chart)
Use `late_arrival_distribution` array to show when employees arrive late (by hour).

#### 5. Top Performers (Table/List)
Display `top_performers` array showing employees with highest attendance.

### Use Cases

- **HR Management**: Monitor overall attendance trends and patterns
- **Department Performance**: Compare attendance across departments
- **Late Arrival Analysis**: Identify peak late arrival times for policy decisions
- **Employee Recognition**: Identify top performing employees
- **Attendance Forecasting**: Use historical trends to predict future patterns
- **Policy Evaluation**: Measure impact of attendance policies

### Example Request

```bash
curl -X GET "https://sac.saksolution.com/api/v1/reports/attendance/dashboard?start_date=2025-12-01&end_date=2025-12-15" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Example Request (Specific Department)

```bash
curl -X GET "https://sac.saksolution.com/api/v1/reports/attendance/dashboard?start_date=2025-12-01&end_date=2025-12-15&department_id=1" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Common Response Codes

| Status Code | Description |
|-------------|-------------|
| `200` | Success - Report generated |
| `400` | Bad Request - Missing or invalid parameters |
| `401` | Unauthorized - Invalid or missing JWT token |
| `403` | Forbidden - Insufficient permissions |
| `500` | Internal Server Error - Report generation failed |

---

## Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "MISSING_DATES",
    "message": "start_date and end_date are required"
  }
}
```

### Error Codes

| Code | Description |
|------|-------------|
| `MISSING_DATES` | Required date parameters not provided |
| `REPORT_GENERATION_FAILED` | Server error while generating report |
| `DASHBOARD_GENERATION_FAILED` | Server error while generating dashboard |
| `INVALID_TOKEN` | JWT token is invalid or expired |
| `INSUFFICIENT_PERMISSIONS` | User role not authorized for this report |

---

## Integration Examples

### Frontend Chart Integration (Chart.js)

#### Daily Attendance Trend

```javascript
// Fetch dashboard data
const response = await fetch(
  'https://sac.saksolution.com/api/v1/reports/attendance/dashboard?start_date=2025-12-01&end_date=2025-12-15',
  {
    headers: { 'Authorization': `Bearer ${token}` }
  }
);

const { data } = await response.json();

// Configure Chart.js
const chartData = {
  labels: data.daily_trend.map(d => d.date),
  datasets: [
    {
      label: 'Present',
      data: data.daily_trend.map(d => d.present),
      borderColor: '#10b981',
      backgroundColor: 'rgba(16, 185, 129, 0.1)'
    },
    {
      label: 'Late',
      data: data.daily_trend.map(d => d.late),
      borderColor: '#f59e0b',
      backgroundColor: 'rgba(245, 158, 11, 0.1)'
    },
    {
      label: 'Absent',
      data: data.daily_trend.map(d => d.absent),
      borderColor: '#ef4444',
      backgroundColor: 'rgba(239, 68, 68, 0.1)'
    }
  ]
};
```

#### Department Comparison

```javascript
const deptData = {
  labels: data.department_statistics.map(d => d.department_name),
  datasets: [{
    label: 'Attendance %',
    data: data.department_statistics.map(d => d.attendance_percentage),
    backgroundColor: [
      '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'
    ]
  }]
};
```

### Export to Excel/CSV

```javascript
// Convert dashboard data to CSV
function exportAttendanceDashboard(data) {
  const csv = [
    ['Date', 'Present', 'Late', 'Absent', 'Half Day', 'Leave'],
    ...data.daily_trend.map(d => [
      d.date,
      d.present,
      d.late,
      d.absent,
      d.half_day,
      d.leave
    ])
  ]
  .map(row => row.join(','))
  .join('\n');

  // Create download link
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `attendance_dashboard_${Date.now()}.csv`;
  a.click();
}
```

---

## Performance Considerations

### Query Optimization

1. **Date Range**: Limit queries to reasonable date ranges (e.g., 1-3 months) to avoid performance issues
2. **Indexing**: Database indexes on `access_time`, `date`, `employee_id`, and `department_id` improve query speed
3. **Caching**: Consider caching report results for frequently accessed date ranges

### Recommended Date Ranges

- **Daily Reports**: Last 7-30 days
- **Monthly Reports**: Last 3-6 months
- **Yearly Reports**: Use aggregated monthly summaries

### Sample Performance

| Report Type | Date Range | Avg Response Time |
|-------------|------------|-------------------|
| Department Access | 30 days | ~800ms |
| Visitor Access | 30 days | ~650ms |
| Attendance Dashboard | 30 days | ~1200ms |

---

## Best Practices

1. **Date Validation**: Always validate date ranges on the client before making requests
2. **Progressive Loading**: Load summary first, then detailed charts on demand
3. **Export Options**: Provide CSV/PDF export for management reports
4. **Caching**: Cache report data for 5-10 minutes to reduce server load
5. **Filters**: Allow users to drill down by department, floor, or employee
6. **Time Zones**: Ensure consistent timezone handling (UTC in backend, local in frontend)

---

## Future Enhancements

- [ ] Real-time dashboard updates using Socket.IO
- [ ] PDF export with charts
- [ ] Scheduled email reports
- [ ] Custom date range presets (This Week, Last Month, This Quarter)
- [ ] Comparison mode (compare two date ranges)
- [ ] Department manager role with department-specific reports
- [ ] Export to Google Sheets/Excel with formatting
- [ ] Predictive analytics for attendance trends

---

## Support

For issues or questions:
- **Backend URL**: https://sac.saksolution.com
- **API Version**: v1
- **Server**: AWS EC2 (3.108.52.219)
- **Status**: Production
