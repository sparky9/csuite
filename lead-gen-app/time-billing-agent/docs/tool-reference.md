# Time & Billing MCP Tool Reference

This reference captures practical payload examples for the stdio server. Each example shows the JSON arguments supplied to the MCP `call_tool` request and a representative response envelope produced by the shared `toToolResponse` helper.

> **Note:** All examples assume you launched the server with an `.env` that sets `TIME_BILLING_DEFAULT_USER_ID`. When omitted in the payload, the helper in `src/tools/helpers.ts` resolves the value automatically.

## time_track_entry

Logs a block of work time and returns the calculated billing details.

**Input**

```json
{
  "clientId": "acme-co",
  "projectName": "website-redesign",
  "taskDescription": "Homepage hero copy revisions",
  "durationMinutes": 90,
  "notes": "Reworked CTA hierarchy"
}
```

**Response**

```json
{
  "success": true,
  "tool": "time_track_entry",
  "data": {
    "message": "Time entry recorded successfully.",
    "entry": {
      "entryId": "e4c3fede-...",
      "durationMinutes": 90,
      "billable": true,
      "calculatedAmount": 225,
      "hourlyRate": 150,
      "currency": "USD",
      "rateSource": "client"
    }
  }
}
```

## time_get_entries

Returns recent entries plus totals for the filtered window.

**Input**

```json
{
  "clientId": "acme-co",
  "projectName": "website-redesign",
  "startDate": "2025-10-01",
  "endDate": "2025-10-31",
  "limit": 25
}
```

**Response (trimmed)**

```json
{
  "success": true,
  "tool": "time_get_entries",
  "data": {
    "summary": {
      "totalHours": 14.5,
      "totalAmount": 2175,
      "unbilledAmount": 450,
      "entryCount": 9
    },
    "entries": [
      {
        "entryId": "a6d2...",
        "clientId": "acme-co",
        "projectName": "website-redesign",
        "task": "Homepage hero copy revisions",
        "date": "2025-10-12",
        "durationMinutes": 90,
        "amount": 225,
        "billable": true,
        "invoiced": false,
        "invoiceId": null
      }
    ]
  }
}
```

## billing_set_rate_card

Creates or updates a rate card for a specific client/project or the default fallback.

**Input**

```json
{
  "clientId": "acme-co",
  "projectName": "website-redesign",
  "hourlyRate": 150,
  "currency": "usd",
  "effectiveDate": "2025-09-01"
}
```

**Response**

```json
{
  "success": true,
  "tool": "billing_set_rate_card",
  "data": {
    "message": "Rate card saved successfully.",
    "rateCard": {
      "rateCardId": "dbec2...",
      "clientId": "acme-co",
      "projectName": "website-redesign",
      "hourlyRate": 150,
      "currency": "USD",
      "effectiveDate": "2025-09-01",
      "isDefault": false
    }
  }
}
```

## billing_get_rate_cards

Lists all accessible rate cards plus the current default value.

**Input**

```json
{
  "clientId": "acme-co"
}
```

**Response (trimmed)**

```json
{
  "success": true,
  "tool": "billing_get_rate_cards",
  "data": {
    "defaultRate": 125,
    "rateCards": [
      {
        "rateCardId": "dbec2...",
        "clientId": "acme-co",
        "projectName": "website-redesign",
        "hourlyRate": 150,
        "currency": "USD",
        "effectiveDate": "2025-09-01",
        "isDefault": false
      }
    ]
  }
}
```

## billing_generate_invoice

Drafts an invoice from billable entries optionally restricted by ids.

**Input**

```json
{
  "clientId": "acme-co",
  "timeEntryIds": ["a6d2...", "c109..."],
  "invoiceDate": "2025-10-15",
  "taxRate": 8.875,
  "discountAmount": 50,
  "notes": "Thanks again for the project!"
}
```

**Response**

```json
{
  "success": true,
  "tool": "billing_generate_invoice",
  "data": {
    "message": "Invoice generated successfully.",
    "invoice": {
      "invoiceId": "9f51...",
      "invoiceNumber": "INV-2025-027",
      "clientId": "acme-co",
      "subtotal": 675,
      "tax": 59.97,
      "discount": 50,
      "total": 684.97,
      "dueDate": "2025-11-14",
      "status": "draft",
      "timeEntriesIncluded": 2
    }
  }
}
```

## billing_send_invoice

Marks an invoice as sent and records the delivery preference.

**Input**

```json
{
  "invoiceId": "9f51...",
  "deliveryMethod": "email",
  "recipientEmail": "billing@acme.example"
}
```

**Response**

```json
{
  "success": true,
  "tool": "billing_send_invoice",
  "data": {
    "message": "Invoice marked as sent.",
    "invoice": {
      "invoiceId": "9f51...",
      "status": "sent",
      "sentAt": "2025-10-15T18:32:05.934Z",
      "deliveryMethod": "email",
      "trackingEnabled": true
    }
  }
}
```

## billing_track_invoice_status

Fetches the latest totals and timeline for an invoice.

**Input**

```json
{
  "invoiceId": "9f51..."
}
```

**Response**

```json
{
  "success": true,
  "tool": "billing_track_invoice_status",
  "data": {
    "invoice": {
      "invoiceId": "9f51...",
      "invoiceNumber": "INV-2025-027",
      "status": "sent",
      "sentAt": "2025-10-15T18:32:05.934Z",
      "viewedAt": null,
      "dueDate": "2025-11-14",
      "daysOverdue": 0,
      "total": 684.97,
      "amountPaid": 0,
      "amountDue": 684.97
    }
  }
}
```

## billing_record_payment

Records an incoming payment and returns the refreshed balances.

**Input**

```json
{
  "invoiceId": "9f51...",
  "amount": 350,
  "paymentDate": "2025-11-03",
  "paymentMethod": "ach",
  "transactionId": "txn-2048"
}
```

**Response**

```json
{
  "success": true,
  "tool": "billing_record_payment",
  "data": {
    "message": "Payment recorded successfully.",
    "payment": {
      "paymentId": "2c71...",
      "invoiceId": "9f51...",
      "amountPaid": 350,
      "remainingBalance": 334.97,
      "invoiceStatus": "sent",
      "paidAt": null
    }
  }
}
```

## billing_generate_payment_reminder

Drafts reminder copy for an overdue invoice based on tone.

**Input**

```json
{
  "invoiceId": "9f51...",
  "tone": "firm"
}
```

**Response**

```json
{
  "success": true,
  "tool": "billing_generate_payment_reminder",
  "data": {
    "reminder": {
      "reminderId": "41be...",
      "invoiceNumber": "INV-2025-027",
      "tone": "firm",
      "subject": "Payment reminder: Invoice INV-2025-027",
      "messageBody": "Hello,\n\nThis is a reminder that invoice INV-2025-027 was due on 2025-11-14.\nOutstanding balance: $334.97.\n\nLet me know if you have any questions or need support to wrap this up.\n\nThanks,\nYour Time & Billing Assistant",
      "suggestedSendDate": "2025-11-15"
    }
  }
}
```

## billing_get_profitability_report

Summarises billed hours, revenue, and payment velocity across clients.

**Input**

```json
{
  "startDate": "2025-07-01",
  "endDate": "2025-09-30"
}
```

**Response (trimmed)**

```json
{
  "success": true,
  "tool": "billing_get_profitability_report",
  "data": {
    "summary": {
      "totalRevenue": 18450,
      "totalOutstanding": 2650,
      "avgPaymentDays": 21,
      "topClient": "acme-co"
    },
    "clients": [
      {
        "clientId": "acme-co",
        "clientName": "acme-co",
        "totalHours": 68.5,
        "totalBilled": 10275,
        "totalPaid": 8450,
        "avgHourlyRate": 150,
        "paymentVelocity": "on_time",
        "profitMargin": "medium"
      }
    ]
  }
}
```

---

These payloads should give you copy‑paste scaffolds when wiring the agent into downstream automation or tests. Adjust identifiers and totals to match your environment.
