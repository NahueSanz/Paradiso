# Club Flow

A multi-tenant SaaS platform designed to streamline the management of sports clubs through reservations, payments, inventory management, sales tracking, employee administration, and internal communication.

Built entirely by a single developer over 6–8 months of iterative development, Club Flow is currently deployed and used in a real-world environment.

---

## Overview

Sports clubs often rely on spreadsheets, paper forms, phone calls, and WhatsApp messages to manage their daily operations.

Club Flow centralizes these workflows into a single platform, allowing club owners and employees to manage reservations, customers, payments, inventory, sales, staff members, and internal communication from one place.

The platform follows a multi-tenant architecture where multiple clubs can operate independently while sharing the same infrastructure. Each club maintains complete isolation of its data, users, reservations, products, and communications.

---

## Key Features

### Reservation Management

* Manual reservation creation
* Reservation conflict detection
* Visual scheduling calendar
* Reservation status tracking
* Payment tracking
* Reservation history

### Fixed Recurring Reservations

One of the most complex features in the platform.

Club owners can create recurring reservations such as:

> Every Tuesday from 20:00 to 22:00 on Court #2

The system automatically generates reservation instances while maintaining independent payment status, history, and modifications for each occurrence.

### Payment Management

* Paid and pending reservations
* Manual payment registration
* Reservation payment history

### Inventory Management

* Product creation
* Product updates
* Product deletion
* Low-stock alerts
* Stock tracking

### Sales Management

* Sales registration
* Automatic stock deduction
* Sales history
* Inventory synchronization

### Employee Management

* Employee invitations via secure links
* Club-specific roles
* Team management

### Internal Club Chat

Built-in communication system between owners and employees.

Features include:

* Persistent chat history
* Date grouping
* Club isolation
* Role-aware access

### Multi-Club Architecture

A single user can belong to multiple clubs simultaneously.

Each club maintains complete isolation of:

* Reservations
* Employees
* Products
* Payments
* Chat messages
* Settings

This architecture allows Club Flow to scale as a true SaaS platform rather than a single-organization application.

---

## Roles & Permissions

### Owner

Full administrative access.

Capabilities:

* Manage reservations
* Create recurring reservations
* Manage employees
* Manage products
* Manage inventory
* Register sales
* Invite employees
* Manage payments
* Access internal chat

### Employee

Operational access.

Capabilities:

* View reservations
* Create reservations
* Register sales
* Check inventory
* Access internal chat

Restrictions:

* Cannot manage employees
* Cannot create products
* Cannot edit products
* Cannot delete products

Permissions are validated both on the frontend and backend.

---

## Technical Highlights

### Multi-Tenant SaaS Architecture

The platform was designed from the ground up to support multiple independent organizations sharing the same infrastructure while preserving complete data isolation.

### Recurring Reservation Engine

The recurring reservation system required the creation of two dedicated entities:

#### FixedReservation

Represents the recurrence rule.

Example:

* Tuesday
* 20:00
* Court #2
* Customer John

#### FixedReservationInstance

Represents individual generated occurrences.

Example:

* May 5th
* May 12th
* May 19th

Each occurrence maintains its own:

* Payment status
* History
* Modifications

This design allows recurring reservations to coexist with standard reservations while maintaining performance and flexibility.

### Role-Based Access Control

Permissions are enforced on both client and server layers to prevent unauthorized actions and ensure data integrity.

---

## Tech Stack

### Frontend

* React
* TypeScript
* Vite
* React Query
* Context API
* Tailwind CSS
* shadcn/ui
* Framer Motion

### Backend

* Node.js
* Express.js
* TypeScript
* JWT Authentication

### Database

* PostgreSQL
* Prisma ORM

### Infrastructure

* Vercel
* Render
* Docker

### Services

* Supabase Auth
* Nodemailer
* Gmail SMTP

### Tooling

* Git
* GitHub

---

## Challenges Solved

The most significant technical challenge was designing the recurring reservation system.

Requirements included:

* Avoid conflicts with normal reservations
* Support independent payment tracking
* Integrate with the main calendar
* Maintain performance as data grows
* Preserve flexibility for future features

The final architecture introduced a rule-based generation model that separates recurrence definitions from reservation instances.

---

## What I Learned

Club Flow allowed me to deepen my knowledge in:

* Multi-tenant SaaS architecture
* PostgreSQL
* Prisma ORM
* Complex database modeling
* JWT authentication
* Role-based authorization
* REST API design
* Query optimization
* SMTP integrations
* Production deployments
* Infrastructure management
* Data isolation strategies

---

## Development

This project was developed independently from start to finish, including:

* System architecture
* Database design
* Backend development
* Frontend development
* Authentication
* Security
* Deployment
* Bug fixing
* Refactoring

Development time: approximately 6–8 months.

---

## Future Improvements

* Advanced analytics dashboard
* Online payments integration
* Mobile application
* Automated notifications
* Reservation reminders
* Reporting system

---

## Author

Nahuel Sanz

Full Stack Developer specializing in React, TypeScript, Node.js, PostgreSQL, and SaaS application architecture.
