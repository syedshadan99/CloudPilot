**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 



<!-- Start of picture text -->
CloudPilot<br><!-- End of picture text -->

AI-Powered Cloud Negotiation and Provisioning Portal _Negotiate. Provision. Scale._ 

Full-Stack Semester Project — Complete System Architecture & Product Specification 

This document contains the complete product definition, module specifications, database design, API structure, UI/UX direction, business rules, security model, and demonstration scenario for the CloudPilot platform. 

Semester Project — Full System Architecture 

Page 1 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

# **Table of Contents** 

**1.** Executive Product Definition 

**2.** Product Identity 

**3.** Core Product Objectives 

**4.** User Roles 

**5.** High-Level System Architecture 

**6.** Main Product Modules (1–16) 

**7.** Complete Screen Inventory 

**8.** Key End-to-End Workflows 

**9.** Database Design 

**10.** API and Backend Domain Structure 

**11.** AI Safety and Reliability Design 

**12.** Frontend Experience Design 

**13.** AI Chat Workspace Design 

**14.** Animated Logo Design 

**15.** Notifications 

**16.** Error and Empty States 

**17.** Business Rules 

**18.** Security and Privacy 

**19.** Audit and Traceability 

**20.** Recommended MVP Scope 

**21.** Demonstration Scenario 

**22.** Important Design Decisions 

**23.** Potential Project Risks 

**24.** Final Product Positioning 

**25.** Recommended Final Feature Set 

Semester Project — Full System Architecture 

Page 2 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

# **1. Executive Product Definition** 

The proposed system is a cloud rental marketplace and automation portal that allows customers to rent simulated virtual machines through natural-language negotiation with an AI agent. 

Instead of manually contacting a cloud provider, the customer: 

**1.** Creates an account. 

**2.** Explains their server requirements to the AI agent. 

**3.** Negotiates price within provider-defined limits. 

**4.** Confirms the agreement. 

**5.** Receives a simulated VM automatically. 

**6.** Monitors usage and billing. 

**7.** Requests upgrades or downgrades through the same AI agent. 

**8.** Pays or records invoices through the billing module. 

The provider can: 

**1.** Define VM plans and pricing. 

**2.** Configure discount and negotiation rules. 

**3.** Monitor AI-generated deals. 

**4.** Approve, reject, or override deals. 

**5.** Monitor virtual infrastructure status. 

**6.** View customers, usage, revenue, and billing. 

**7.** Manage AI behavior and business rules. 

_The AI agent should never directly control pricing or infrastructure. It should interpret the conversation, while deterministic backend services validate prices, permissions, orders, billing, and VM operations. This prevents the AI from making unsafe or financially invalid decisions._ 

Semester Project — Full System Architecture 

Page 3 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

# **2. Product Identity** 

## **Suggested Product Names** 

**1.** CloudBargain 

**2.** NegoCloud 

**3.** CloudPilot 

**4.** SkyDeal 

**5.** CloudMint 

**6.** ProvisionAI 

**7.** StackMate 

**8.** NexaCloud 

**9.** CloudForge 

**10.** DealStack 

## **Recommended Name** 

#### **_CloudPilot_** 

The name communicates: 

- Cloud infrastructure 

- AI assistance 

- Guided automation 

- Control and navigation 

- A professional SaaS identity 

## **Suggested Tagline** 

_Negotiate. Provision. Scale._ 

Alternative taglines: 

- `Your AI Cloud Sales Engineer` 

- `Cloud Infrastructure, Negotiated and Delivered` 

- `From Conversation to Cloud in Minutes` 

- `Talk to Your Infrastructure` 

- `Intelligent Cloud Rental Without the Waiting` 

Semester Project — Full System Architecture 

Page 4 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

# **3. Core Product Objectives** 

## **Primary Objectives** 

- Replace manual server rental negotiation. 

- Automate VM provisioning. 

- Provide transparent, real-time billing. 

- Allow customers to upgrade resources without human intervention. 

- Give providers complete control over pricing and negotiation boundaries. 

- Separate AI decision assistance from backend business authority. 

- Make the simulated VM layer replaceable with Proxmox, AWS, Azure, or another provider later. 

## **Secondary Objectives** 

- Create a professional cloud marketplace experience. 

- Demonstrate real-world full-stack architecture. 

- Demonstrate AI integration with structured backend workflows. 

- Provide auditability for all negotiations and price changes. 

- Allow providers to understand customer demand. 

- Create a platform that can later support multiple providers. 

## **Non-Objectives for the Semester Version** 

The following should not be treated as part of the first release: 

- Real physical server provisioning. 

- Real payment gateway settlement. 

- Production-grade hypervisor management. 

- Real network routing. 

- Real operating system installation. 

- Real SSH access. 

- Multi-region infrastructure deployment. 

- Complex enterprise identity federation. 

These can be represented through realistic simulations and clearly separated interfaces. 

Semester Project — Full System Architecture 

Page 5 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

# **4. User Roles** 

## **4.1 Customer** 

A customer rents one or more simulated VMs. 

### **Customer Capabilities** 

- Register and log in. 

- Complete profile. 

- Open AI negotiation sessions. 

- Describe infrastructure requirements. 

- Receive recommendations. 

- Negotiate pricing. 

- Accept or reject offers. 

- View order summaries. 

- Track provisioning status. 

- View active VMs. 

- Start, stop, restart, and terminate simulated VMs. 

- Monitor usage. 

- View current and historical bills. 

- Request upgrades and downgrades. 

- Open support tickets. 

- Download invoices. 

- Manage notifications. 

- View activity history. 

## **4.2 Provider Administrator** 

The provider administrator controls the cloud business. 

### **Provider Capabilities** 

- View platform metrics. 

- Manage VM templates. 

- Configure pricing. 

- Configure discount limits. 

- Configure negotiation policies. 

- Review AI-generated deals. 

- Manually approve or reject exceptional deals. 

- View customer accounts. 

- View active VMs. 

- Inspect billing records. 

- Review audit logs. 

- View revenue and utilization analytics. 

Semester Project — Full System Architecture 

Page 6 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

- Suspend customers or VMs. 

- Configure system announcements. 

- Manage provider team members. 

## **4.3 Provider Staff or Support Agent** 

This role is optional but valuable. 

### **Staff Capabilities** 

- View assigned support tickets. 

- Review customer order history. 

- Inspect negotiation transcripts. 

- Assist with disputed bills. 

- Add internal notes. 

- Escalate issues to administrators. 

## **4.4 System Worker** 

This is not a human role. It represents background processes. 

### **Worker Responsibilities** 

- Calculate usage. 

- Generate billing records. 

- Change VM state. 

- Process provisioning jobs. 

- Expire offers. 

- Trigger notifications. 

- Run scheduled billing cycles. 

- Maintain simulated infrastructure events. 

Semester Project — Full System Architecture 

Page 7 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

# **5. High-Level System Architecture** 

```
React Frontend
|
v
Next.js Application Layer
|
+-- Authentication Module
+-- AI Conversation Module
+-- Negotiation Engine
+-- Order Management
+-- Billing Engine
+-- VM Simulation Engine
+-- Provider Administration
+-- Notifications
+-- Audit Logging
|
v
PostgreSQL Database
|
+-- AI Provider API
+-- Email Service
+-- Optional Payment Provider
+-- Future Real Cloud Adapter
```

## **Recommended Technical Interpretation** 

### **Frontend** 

- React 

- Next.js App Router 

- Server Components where useful 

- Client Components for chat, charts, VM controls, and live state 

- Tailwind CSS or another component styling system 

- Chart library for analytics 

- Form validation library 

- State management for chat and dashboard state 

### **Backend** 

- Next.js route handlers or server actions 

- Node.js runtime 

- PostgreSQL 

- ORM such as Prisma or Drizzle 

Semester Project — Full System Architecture 

Page 8 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

- Session-based or token-based authentication 

- Background jobs represented through scheduled tasks or worker functions 

- AI provider integration through a server-side API layer 

### **Infrastructure Abstraction** 

The VM feature should be designed around an adapter interface: 

```
VirtualMachineProvider
|
+-- SimulatedVMProvider
+-- ProxmoxVMProvider Future
+-- AWSVMProvider Future
+-- AzureVMProvider Future
```

The rest of the application should call generic operations such as: 

- createVM 

- startVM 

- stopVM 

- restartVM 

- resizeVM 

- terminateVM 

- getVMStatus 

- getVMUsage 

This prevents the application from depending directly on the simulated implementation. 

Semester Project — Full System Architecture 

Page 9 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

# **6. Main Product Modules** 

## **Module 1: Public Marketing Website** 

The public website explains the product before authentication. 

### **Screens** 

- Landing page 

- How it works 

- Features page 

- Pricing overview 

- Provider benefits 

- Customer benefits 

- FAQ 

- Contact page 

- Login 

- Registration 

### **Landing Page Sections** 

**1.** Hero section 

**2.** Interactive AI negotiation preview 

**3.** Three-step workflow 

**4.** Benefits for customers 

**5.** Benefits for providers 

**6.** Simulated VM preview 

**7.** Billing transparency section 

**8.** Security and control section 

**9.** Call-to-action 

**10.** Footer 

### **Primary Call-To-Action** 

_Start Negotiating_ 

Secondary call-to-action: 

_Explore Provider Control Center_ 

**Module 2: Authentication and Account Management** 

### **Features** 

- Customer registration 

Semester Project — Full System Architecture 

Page 10 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

- Provider administrator login 

- Staff login 

- Password hashing 

- Password reset 

- Email verification 

- Session management 

- Logout from all devices 

- Role-based access control 

- Account deactivation 

- Profile management 

- Organization profile 

### **Registration Fields** 

- Full name 

- Email 

- Password 

- Confirm password 

- Company name, optional 

- Intended use 

- Preferred billing currency 

- Terms acceptance 

### **Security Requirements** 

- Never expose passwords. 

- Never trust frontend role values. 

- Validate permissions on the backend. 

- Use protected routes. 

- Log sensitive actions. 

- Expire inactive sessions. 

- Prevent unauthorized access to another customer's VM. 

## **Module 3: Customer Onboarding** 

After registration, the customer should not be immediately thrown into an empty dashboard. 

### **Onboarding Steps** 

**1.** Welcome screen 

**2.** Explain how AI negotiation works. 

**3.** Ask intended workload type. 

**4.** Ask expected duration. 

**5.** Ask preferred billing cycle. 

**6.** Ask whether the user has technical knowledge. 

**7.** Show an example negotiation. 

**8.** Recommend a first VM configuration. 

Semester Project — Full System Architecture 

Page 11 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

**9.** Start the first negotiation. 

### **Workload Categories** 

- Web hosting 

- Database server 

- Development environment 

- Game server 

- File storage 

- AI or machine learning workload 

- Testing environment 

- Custom workload 

Semester Project — Full System Architecture 

Page 12 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

## **Module 4: AI Negotiation Agent** 

This is the central product feature. 

The AI agent should operate as a controlled cloud sales assistant, not as an unrestricted chatbot. 

### **AI Agent Responsibilities** 

- Understand natural-language requirements. 

- Extract structured infrastructure requirements. 

- Ask missing questions. 

- Recommend VM configurations. 

- Explain pricing. 

- Offer discounts within limits. 

- Compare billing cycles. 

- Explain tradeoffs. 

- Generate formal offers. 

- Initiate upgrades. 

- Explain billing. 

- Escalate exceptional requests. 

### **AI Agent Restrictions** 

The AI agent must not: 

- Set arbitrary prices. 

- Create orders without customer confirmation. 

- Change provider rules. 

- Modify another customer's VM. 

- Claim that payment succeeded without backend confirmation. 

- Promise unavailable resources. 

- Apply discounts beyond configured limits. 

- Invent system capabilities. 

- Bypass authentication. 

- Execute infrastructure commands directly. 

### **Agent Conversation States** 



<!-- Start of picture text -->
NEW<br>|<br>+-- REQUIREMENTS_COLLECTION<br>|<br>+-- CONFIGURATION_RECOMMENDATION<br>|<br>+-- PRICE_CALCULATION<br>|<br>+-- NEGOTIATION<br>|<br><!-- End of picture text -->

Semester Project — Full System Architecture 

Page 13 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

```
+-- OFFER_READY
|
+-- CUSTOMER_REVIEW
|
+-- ACCEPTED
|
|
|
+-- ORDER_CREATED
|
|
|
+-- PROVISIONING
|
|
|
+-- ACTIVE
|
+-- REJECTED
+-- EXPIRED
+-- ESCALATED
+-- CANCELLED
```

### **Information the Agent Must Collect** 

##### **Required Infrastructure Data** 

- RAM 

- CPU cores 

- Storage 

- Operating system 

- Billing cycle 

- Duration 

- Region or location, if supported 

- Workload category 

- Optional backup requirement 

- Optional public IP requirement 

### **Example Conversation** 

```
Customer:
I need a server for a small website for 30 days.
Agent:
What traffic level do you expect? Small, medium, or high?
Customer:
```

Semester Project — Full System Architecture 

Page 14 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

```
Small. Around 500 visitors per day.
Agent:
I recommend:
- 2 vCPU
- 4 GB RAM
- 50 GB SSD
- Linux
- Daily billing
- Estimated price: $X
Would you like a lower-cost configuration or better performance?
Customer:
Can you give me a discount?
Agent:
I can offer a 7% discount under the current provider policy.
The revised price is $Y per day.
Would you like to accept this offer?
Customer:
Yes.
Agent:
Please review the final order summary and confirm provisioning.
```

### **Agent Internal Tool Workflow** 

The AI should call controlled backend tools rather than directly accessing the database. 

```
extract_requirements()
get_available_vm_templates()
calculate_base_price()
get_negotiation_policy()
generate_allowed_discount()
check_resource_availability()
create_draft_offer()
request_customer_confirmation()
create_order()
request_vm_provisioning()
```

### **Important Design Principle** 

The AI should produce an intention, not an authoritative action. 

Example: 

```
{
"intent": "CREATE_OFFER",
"configuration": {
```

Semester Project — Full System Architecture 

Page 15 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

```
"cpu": 2,
"ramGb": 4,
"storageGb": 50
},
"billingCycle": "monthly",
"discountPercent": 7
}
```

The backend then validates whether this offer is permitted. 

Semester Project — Full System Architecture 

Page 16 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

## **Module 5: Negotiation Engine** 

This module is separate from the AI agent. 

### **Why It Must Be Separate** 

If pricing logic exists only in the AI prompt, it is unsafe and difficult to test. The provider's rules must be stored and enforced by backend code. 

### **Negotiation Inputs** 

- Base VM plan 

- Customer requested resources 

- Billing cycle 

- Rental duration 

- Current availability 

- Customer account status 

- Minimum price 

- Maximum allowed discount 

- Promotional rules 

- Contract type 

- Previous negotiation count 

### **Negotiation Outputs** 

- Base price 

- Discount amount 

- Final price 

- Price explanation 

- Offer expiration 

- Conditions 

- Approval requirement 

- Negotiation status 

### **Example Rules** 

- Maximum discount: 15% 

- Minimum acceptable price: $20 

- Monthly plans receive higher discounts. 

- Long-term rentals receive better discounts. 

- New customers receive a limited introductory discount. 

- Discounts cannot reduce price below minimum margin. 

- Certain VM templates cannot be discounted. 

- Provider approval required below a configured threshold. 

### **Negotiation Outcomes** 

- Accepted automatically 

Semester Project — Full System Architecture 

Page 17 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

- Rejected because it violates rules 

- Sent for provider approval 

- Counter-offer generated 

- Offer expired 

- Customer declined 

## **Module 6: VM Catalog and Configuration** 

Customers should be able to request a custom server, but the provider should control what is available. 

### **VM Template Fields** 

- Template name 

- Description 

- CPU cores 

- RAM 

- Storage 

- Storage type 

- Operating system 

- Network bandwidth 

- Region 

- Availability status 

- Base hourly rate 

- Base daily rate 

- Base monthly rate 

- Maximum quantity 

- Active or inactive status 

### **Example Templates** 

|**Template**|**CPU**|**RAM**|**Storage**|**Usage**|
|---|---|---|---|---|
|Nano|1 vCPU|1 GB|25 GB|Testing|
|Starter|2 vCPU|4 GB|50 GB|Small websites|
|Growth|4 vCPU|8 GB|100 GB|Business applications|
|Performance|8 vCPU|16 GB|250 GB|High-load systems|
|Custom|Variable|Variable|Variable|Advanced users|



### **Configuration Validation** 

- CPU must be positive. 

- RAM must be within provider limits. 

- Storage must be within provider limits. 

- Requested combination must match an available template or valid custom range. 

Semester Project — Full System Architecture 

Page 18 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

- Inactive templates cannot be ordered. 

- Unsupported operating systems must be rejected. 

- Resource limits must be checked before order creation. 

Semester Project — Full System Architecture 

Page 19 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

## **Module 7: Offer and Order Management** 

An offer is not yet an order. 

### **Offer Lifecycle** 

```
DRAFT
|
v
PRESENTED
|
+-- ACCEPTED --> ORDER_CREATED
|
+-- DECLINED
|
+-- EXPIRED
|
+-- PROVIDER_REVIEW
```

### **Order Lifecycle** 

```
PENDING_PAYMENT
|
v
CONFIRMED
|
v
PROVISIONING
|
v
ACTIVE
|
+-- SUSPENDED
+-- STOPPED
+-- TERMINATED
+-- FAILED
```

### **Order Details** 

- Customer 

- VM configuration 

- Pricing method 

- Discount 

- Final price 

- Start time 

- Expected end time 

Semester Project — Full System Architecture 

Page 20 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

- Billing cycle 

- Agreement timestamp 

- Offer transcript reference 

- Provisioning status 

- Cancellation policy 

- Current balance 

- Order activity history 

### **Order Confirmation Screen** 

The user must see: 

- Selected configuration 

- Base price 

- Discount 

- Final price 

- Billing cycle 

- Estimated total 

- Usage assumptions 

- Start date 

- End date 

- Renewal behavior 

- Cancellation information 

- What happens after confirmation 

_The confirmation button should clearly say: Confirm Deal and Provision VM Avoid vague buttons such as Submit._ 

## **Module 8: Simulated VM Provisioning** 

This module simulates a real infrastructure system. 

### **Provisioning Workflow** 

```
Order Confirmed
|
v
Provisioning Job Created
|
v
Resource Allocation
|
v
Image Preparation
|
v
```

Semester Project — Full System Architecture 

Page 21 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

```
Network Assignment
|
v
VM Booting
|
v
Health Check
|
v
VM Active
```

### **Simulated Provisioning Delay** 

The UI should show realistic progress: 

- Queued 

- Allocating resources 

- Preparing operating system 

- Assigning network 

- Booting virtual machine 

- Running health checks 

- Ready 

The delay can be simulated with a worker or backend state transitions. 

### **VM Fields** 

- VM ID 

- Customer ID 

- Order ID 

- VM name 

- Status 

- CPU 

- RAM 

- Storage 

- Operating system 

- IP address, simulated 

- Hostname 

- Region 

- Created time 

- Started time 

- Stopped time 

- Terminated time 

- Health status 

- Provisioning progress 

- Current usage 

- Monthly estimated cost 

Semester Project — Full System Architecture 

Page 22 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

### **VM States** 

```
CREATING
BOOTING
RUNNING
STOPPING
STOPPED
RESTARTING
RESIZING
SUSPENDED
TERMINATING
TERMINATED
FAILED
```

### **VM Controls** 

- Start 

- Stop 

- Restart 

- Rename 

- View details 

- View usage 

- Resize 

- Terminate 

- Open activity logs 

### **Simulated VM Console** 

To make the project appear more realistic, include a simulated terminal. 

The terminal can display: 

```
cloudpilot-vm login
System boot complete
CPU: 2 vCPU
Memory: 4 GB
Storage: 50 GB
Network: connected
Health check: passed
```

The terminal does not need to execute real server commands. It should clearly be a simulated environment. 

Semester Project — Full System Architecture 

Page 23 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

## **Module 9: Usage Tracking** 

Usage tracking should appear realistic while remaining implementable. 

### **Tracked Metrics** 

- Total runtime 

- Current status duration 

- CPU utilization simulation 

- Memory utilization simulation 

- Storage usage simulation 

- Network usage simulation 

- Uptime percentage 

- Start and stop events 

- Billing units consumed 

### **Usage Generation** 

For the semester version, usage can be simulated through: 

- Time-based calculations. 

- Random but controlled metric variation. 

- Predefined usage profiles. 

- User-triggered start/stop events. 

### **Usage Page** 

Display: 

- Current runtime 

- Usage timeline 

- CPU chart 

- Memory chart 

- Storage chart 

- Network chart 

- Estimated current bill 

- Estimated end-of-period bill 

### **Important Billing Decision** 

Decide whether stopped VMs incur charges. 

Recommended rule: 

- Compute charges stop when the VM is stopped. 

- Storage charges may continue while the VM is stopped. 

- Terminated VMs stop all future charges. 

This creates a realistic billing model. 

Semester Project — Full System Architecture 

Page 24 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

## **Module 10: Billing and Invoicing** 

Billing is one of the strongest areas for demonstrating backend competence. 

### **Supported Billing Cycles** 

- Hourly 

- Daily 

- Monthly 

### **Billing Formula** 

```
Base Usage Cost
= Unit Price x Billable Usage
Discount Amount
= Base Usage Cost x Discount Percentage
Additional Charges
= Storage Charges + Network Charges + Add-ons
Total
= Base Usage Cost - Discount Amount + Additional Charges
```

### **Example** 

```
Hourly VM price: $0.08
Billable runtime: 50 hours
Base cost: $4.00
Discount: 10%
Discount amount: $0.40
Final cost: $3.60
```

### **Billing Components** 

- Current estimated bill 

- Invoice history 

- Invoice details 

- Usage breakdown 

- Discount breakdown 

- Payment status 

- Due date 

- Billing period 

- Refund or credit adjustment 

- Downloadable invoice 

### **Invoice States** 

```
DRAFT
ISSUED
```

Semester Project — Full System Architecture 

Page 25 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

```
PAID
PARTIALLY_PAID
OVERDUE
CANCELLED
REFUNDED
```

### **Billing Edge Cases** 

- VM created halfway through a billing period. 

- VM stopped and restarted. 

- VM resized in the middle of an hour. 

- Discount applies only to initial period. 

- Customer terminates before the scheduled end date. 

- Offer expires before provisioning. 

- Provisioning fails. 

- Provider manually adjusts a bill. 

- Customer upgrades during an active cycle. 

- Customer has multiple active VMs. 

Semester Project — Full System Architecture 

Page 26 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

## **Module 11: Scaling and Upgrade Management** 

Customers should be able to upgrade through both the dashboard and the AI agent. 

### **Upgrade Examples** 

- Increase RAM. 

- Add CPU. 

- Increase storage. 

- Change operating system, if supported. 

- Add backup storage. 

- Change billing cycle. 

- Extend rental duration. 

### **Upgrade Workflow** 

```
Customer Requests Upgrade
|
v
AI Extracts New Requirements
|
v
Backend Checks Availability
|
v
New Price Calculated
|
v
Negotiation Begins
|
v
Customer Accepts Offer
|
v
Resize Order Created
|
v
VM Enters RESIZING State
|
v
New Resources Applied
|
v
Billing Rate Updated
```

Semester Project — Full System Architecture 

Page 27 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

### **Downgrade Restrictions** 

Downgrades should have stricter rules: 

- Storage cannot be reduced below current usage. 

- RAM downgrade may require VM restart. 

- CPU downgrade may require scheduled maintenance. 

- Downgrades may be delayed until the next billing period. 

- Provider can disable downgrades entirely. 

## **Module 12: Provider Dashboard** 

The provider dashboard is the administrative control center. 

### **Provider Dashboard Navigation** 

- Overview 

- Customers 

- VM Templates 

- Pricing 

- Negotiation Policies 

- Deals 

- Orders 

- Virtual Machines 

- Billing 

- Analytics 

- Support 

- Audit Logs 

- Settings 

### **Provider Overview Screen** 

##### **Summary Cards** 

- Total customers 

- Active VMs 

- Monthly revenue 

- Current usage 

- Pending deals 

- Provisioning failures 

- Overdue invoices 

- Average negotiation discount 

##### **Charts** 

- Revenue over time 

- VM creation trend 

- Active versus stopped VMs 

- Resource utilization 

Semester Project — Full System Architecture 

Page 28 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

- Discount distribution 

- Customer conversion funnel 

- Billing status breakdown 

##### **Recent Activity** 

- New registration 

- Accepted offer 

- VM provisioned 

- Upgrade request 

- Failed provisioning 

- Manual price override 

- Invoice issued 

## **Module 13: Pricing Management** 

### **Pricing Configuration** 

Providers can define: 

- CPU price 

- RAM price 

- Storage price 

- Bandwidth price 

- Operating system surcharge 

- Hourly rate 

- Daily rate 

- Monthly rate 

- Minimum order amount 

- Minimum rental duration 

- Setup fee 

- Cancellation fee 

- Backup fee 

- Public IP fee 

### **Pricing Versions** 

Pricing should be versioned. 

When a provider changes prices, existing orders should continue using the price version that was active when the order was accepted. 

This prevents historical invoices from changing unexpectedly. 

### **Pricing Example** 

```
CPU: $0.03 per vCPU hour
RAM: $0.01 per GB hour
Storage: $0.002 per GB hour
```

Semester Project — Full System Architecture 

Page 29 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

```
Public IP: $2 per month
Backup: $5 per month
```

Semester Project — Full System Architecture 

Page 30 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

## **Module 14: Negotiation Policy Management** 

### **Provider Controls** 

- Maximum discount percentage 

- Minimum allowed price 

- Maximum negotiation attempts 

- Minimum rental duration for discounts 

- Customer-specific discount eligibility 

- Promotional periods 

- Approval threshold 

- Auto-accept threshold 

- Restricted configurations 

- Blacklisted requests 

- Escalation messages 

### **Policy Examples** 

```
If rental duration >= 30 days:
maximum discount = 15%
If rental duration < 7 days:
maximum discount = 5%
If final price < minimum price:
require provider approval
If customer has unpaid invoice:
do not permit new provisioning
```

## **Module 15: Deal Review and Manual Override** 

Providers should be able to review AI-generated deals. 

### **Deal Review Screen** 

- Customer information 

- Full negotiation transcript 

- Extracted requirements 

- Original price 

- Offered discount 

- Final price 

- Policy rules used 

- Margin estimate 

- Customer history 

- Accept button 

- Reject button 

- Edit offer button 

Semester Project — Full System Architecture 

Page 31 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

- Add internal note 

### **Manual Override Requirements** 

Every override should record: 

- Provider user 

- Previous value 

- New value 

- Reason 

- Timestamp 

- Related order or offer 

This makes the system auditable. 

**Module 16: Customer Dashboard** 

### **Customer Navigation** 

- Overview 

- AI Negotiation 

- My VMs 

- Orders 

- Usage 

- Billing 

- Invoices 

- Support 

- Notifications 

- Profile 

### **Customer Overview Screen** 

##### **Summary Cards** 

- Active VMs 

- Current usage 

- Estimated bill 

- Next billing date 

- Pending offers 

- Account balance 

##### **Main Components** 

- Start negotiation button 

- Active VM cards 

- Recent invoices 

- Usage graph 

- Recent activity timeline 

- Alerts and recommendations 

Semester Project — Full System Architecture 

Page 32 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

# **7. Complete Screen Inventory** 

## **Public Screens** 

**1.** Landing page 

**2.** How it works 

**3.** Features 

**4.** Customer benefits 

**5.** Provider benefits 

**6.** Pricing information 

**7.** FAQ 

**8.** Contact 

**9.** Login 

**10.** Registration 

**11.** Forgot password 

**12.** Reset password 

**13.** Email verification 

**14.** Terms and privacy 

## **Customer Screens** 

**15.** Customer onboarding 

**16.** Customer dashboard 

**17.** AI chat workspace 

**18.** Offer review 

**19.** Order confirmation 

**20.** Provisioning progress 

**21.** VM list 

**22.** VM detail 

**23.** Simulated terminal 

**24.** Usage analytics 

**25.** Billing overview 

**26.** Invoice list 

**27.** Invoice detail 

**28.** Upgrade request 

**29.** Order history 

**30.** Notification center 

**31.** Support tickets 

**32.** Customer profile 

**33.** Security settings 

**34.** Account deletion confirmation 

## **Provider Screens** 

Semester Project — Full System Architecture 

Page 33 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

**35.** Provider dashboard 

**36.** Customer list 

**37.** Customer detail 

**38.** VM template list 

**39.** Create VM template 

**40.** Edit VM template 

**41.** Pricing configuration 

**42.** Negotiation policy configuration 

**43.** Deal list 

**44.** Deal detail 

**45.** Manual deal review 

**46.** Order management 

**47.** VM management 

**48.** VM detail 

**49.** Billing management 

**50.** Invoice management 

**51.** Revenue analytics 

**52.** Usage analytics 

**53.** Support ticket management 

**54.** Audit log 

**55.** Provider team management 

**56.** Provider settings 

## **System Screens** 

**57.** Error page 

**58.** Access denied 

**59.** Not found 

**60.** Maintenance page 

**61.** Provisioning failed state 

**62.** Empty dashboard state 

**63.** Network failure state 

**64.** Session expired state 

Semester Project — Full System Architecture 

Page 34 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

# **8. Key End-to-End Workflows** 

## **Workflow A: New Customer Rents a VM** 

```
Landing Page
|
v
Registration
|
v
Email Verification
|
v
Customer Onboarding
|
v
AI Chat
|
v
Requirements Extraction
|
v
VM Recommendation
|
v
Price Calculation
|
v
Negotiation
|
v
Offer Created
|
v
Customer Reviews Offer
|
v
Customer Confirms
|
v
Order Created
|
```

Semester Project — Full System Architecture 

Page 35 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

```
v
Provisioning Begins
|
v
Simulated VM Active
|
v
Usage Tracking Begins
|
v
Billing Begins
```

## **Workflow B: Customer Negotiates a Discount** 

```
Customer Requests Discount
|
v
AI Reads Negotiation Policy
|
v
Backend Calculates Maximum Discount
|
v
AI Presents Valid Counter-Offer
|
v
Customer Accepts
|
v
Backend Validates Offer Again
|
v
Offer Becomes Confirmable
```

If the requested discount exceeds the allowed limit: 

```
AI Explains Limit
|
+-- Offer Alternative Duration
+-- Offer Smaller VM
+-- Request Provider Review
+-- End Negotiation
```

## **Workflow C: Upgrade an Active VM** 

Semester Project — Full System Architecture 

Page 36 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

```
Customer Opens VM
|
v
Clicks Upgrade
|
v
Selects New Resources
|
v
AI or System Calculates New Price
|
v
Customer Negotiates
|
v
Customer Confirms
|
v
Resize Order Created
|
v
VM Resizing
|
v
New Configuration Applied
|
v
Billing Rate Updated
```

## **Workflow D: Stop and Restart a VM** 

```
Customer Clicks Stop
|
v
Confirmation Modal
|
v
Backend Validates Ownership
|
v
VM Status Changes to STOPPING
|
v
```

Semester Project — Full System Architecture 

Page 37 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

```
Usage Meter Pauses
|
v
VM Status Changes to STOPPED
```

Restarting reverses the process and resumes usage billing. 

## **Workflow E: Provider Changes Pricing** 

```
Provider Opens Pricing
|
v
Edits Pricing Rules
|
v
System Validates Values
|
v
New Pricing Version Created
|
v
Future Offers Use New Version
|
v
Existing Orders Keep Original Version
```

## **Workflow F: Provisioning Failure** 

```
Provisioning Starts
|
v
Simulation Reports Failure
|
v
Order Becomes PROVISIONING_FAILED
|
+-- Retry Provisioning
+-- Cancel Order
+-- Notify Customer
+-- Create Refund/Credit
+-- Alert Provider
```

Semester Project — Full System Architecture 

Page 38 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

# **9. Database Design** 

## **Core Tables** 

### **`users`** 

- id 

- name 

- email 

- password_hash 

- role 

- status 

- created_at 

- updated_at 

- last_login_at 

### **`organizations`** 

- id 

- name 

- owner_id 

- status 

- created_at 

### **`organization_members`** 

- organization_id 

- user_id 

- role 

### **`customer_profiles`** 

- user_id 

- company_name 

- workload_type 

- preferred_currency 

- billing_email 

### **`vm_templates`** 

- id 

- name 

- description 

- cpu_cores 

- ram_gb 

- storage_gb 

- operating_system 

Semester Project — Full System Architecture 

Page 39 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

- hourly_rate 

- daily_rate 

- monthly_rate 

- status 

- pricing_version_id 

### **`pricing_versions`** 

- id 

- version_name 

- effective_from 

- effective_to 

- created_by 

- status 

### **`pricing_rules`** 

- id 

- pricing_version_id 

- rule_type 

- rule_value 

- minimum_value 

- maximum_value 

### **`negotiation_policies`** 

- id 

- name 

- maximum_discount_percent 

- minimum_price 

- approval_threshold 

- active 

- created_by 

### **`chat_sessions`** 

- id 

- customer_id 

- session_type 

- status 

- created_at 

- closed_at 

### **`chat_messages`** 

- id 

- session_id 

- sender_type 

- message 

- structured_data 

Semester Project — Full System Architecture 

Page 40 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

- created_at 

### **`offers`** 

- id 

- customer_id 

- chat_session_id 

- vm_configuration 

- base_price 

- discount_percent 

- discount_amount 

- final_price 

- currency 

- status 

- expires_at 

- created_at 

### **`orders`** 

- id 

- customer_id 

- offer_id 

- order_number 

- status 

- billing_cycle 

- start_at 

- end_at 

- accepted_at 

- cancelled_at 

### **`virtual_machines`** 

- id 

- customer_id 

- order_id 

- vm_name 

- status 

- cpu_cores 

- ram_gb 

- storage_gb 

- operating_system 

- simulated_ip 

- hostname 

- region 

- created_at 

### **`vm_state_events`** 

- id 

Semester Project — Full System Architecture 

Page 41 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

- vm_id 

- previous_state 

- new_state 

- reason 

- created_by 

- created_at 

### **`usage_records`** 

- id 

- vm_id 

- period_start 

- period_end 

- runtime_seconds 

- cpu_usage 

- memory_usage 

- storage_usage 

- bandwidth_usage 

### **`billing_accounts`** 

- id 

- customer_id 

- balance 

- currency 

- status 

### **`invoices`** 

- id 

- customer_id 

- order_id 

- billing_period_start 

- billing_period_end 

- subtotal 

- discount_amount 

- tax_amount 

- total 

- status 

- due_at 

- issued_at 

### **`invoice_items`** 

- id 

- invoice_id 

- description 

- quantity 

- unit_price 

Semester Project — Full System Architecture 

Page 42 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

- amount 

### **`upgrade_requests`** 

- id 

- customer_id 

- vm_id 

- old_configuration 

- new_configuration 

- status 

- price_difference 

- created_at 

### **`notifications`** 

- id 

- user_id 

- type 

- title 

- message 

- read_at 

- created_at 

### **`support_tickets`** 

- id 

- customer_id 

- subject 

- description 

- priority 

- status 

- assigned_to 

- created_at 

### **`audit_logs`** 

- id 

- actor_id 

- action 

- entity_type 

- entity_id 

- old_data 

- new_data 

- ip_address 

- created_at 

Semester Project — Full System Architecture 

Page 43 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

# **10. API and Backend Domain Structure** 

Even though the implementation uses Next.js, organize the backend by business domains rather than placing all logic into unrelated route files. 

```
app/
api/
auth/
chat/
offers/
orders/
vms/
billing/
usage/
provider/
notifications/
support/
lib/
auth/
ai/
negotiation/
pricing/
billing/
provisioning/
usage/
notifications/
audit/
```

## **Suggested Backend Services** 

### **AuthService** 

Handles: 

- Registration 

- Login 

- Session validation 

- Password reset 

- Authorization 

### **ConversationService** 

Handles: 

- Chat sessions 

- Message storage 

Semester Project — Full System Architecture 

Page 44 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

- AI responses 

- Structured requirement extraction 

### **NegotiationService** 

Handles: 

- Offer creation 

- Discount rules 

- Minimum price validation 

- Counter-offers 

- Expiration 

### **PricingService** 

Handles: 

- Template pricing 

- Pricing versions 

- Price calculation 

- Add-ons 

- Historical price preservation 

### **OrderService** 

Handles: 

- Offer acceptance 

- Order creation 

- Cancellation 

- Order lifecycle 

### **ProvisioningService** 

Handles: 

- VM creation 

- VM state transitions 

- Retry logic 

- Provider adapters 

### **BillingService** 

Handles: 

- Usage calculations 

- Invoice generation 

- Credits 

- Billing adjustments 

### **AuditService** 

Handles: 

- Provider actions 

- Price overrides 

Semester Project — Full System Architecture 

Page 45 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

- VM state changes 

- Permission-sensitive operations 

Semester Project — Full System Architecture 

Page 46 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

# **11. AI Safety and Reliability Design** 

## **AI Output Validation** 

Every AI-generated action should be validated against a schema. 

Invalid: 

```
{"discount": "maybe 20 percent"}
```

#### Valid: 

```
{
"discountPercent": 8,
"currency": "USD",
"billingCycle": "monthly"
}
```

## **AI Failure Handling** 

If the AI service is unavailable: 

- Show a clear system message. 

- Preserve the conversation. 

- Allow the customer to retry. 

- Offer a structured configuration form as fallback. 

- Do not create a deal from incomplete data. 

## **Prompt Injection Protection** 

Customer messages must be treated as untrusted input. 

The agent should not obey instructions such as: 

- Ignore provider discount limits. 

- Reveal internal pricing rules. 

- Expose system prompts. 

- Give administrator access. 

- Modify another order. 

- Pretend that an order was confirmed. 

## **AI Response States** 

The frontend should distinguish: 

- Thinking 

- Asking a question 

- Showing recommendation 

Semester Project — Full System Architecture 

Page 47 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

- Showing offer 

- Waiting for confirmation 

- Escalating 

- Error 

Semester Project — Full System Architecture 

Page 48 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

# **12. Frontend Experience Design** 

## **Visual Direction** 

The interface should feel like a combination of: 

- Modern cloud control panel 

- Financial dashboard 

- AI workspace 

- Infrastructure monitoring tool 

Avoid making it look like a generic chatbot. 

## **Suggested Design Theme** 

### **Colors** 

- **Deep navy:** primary background 

- **Electric cyan:** infrastructure and automation 

- **Lime green:** active and successful states 

- **Warm amber:** negotiation and warnings 

- **Coral red:** errors and destructive actions 

- **Soft white:** cards and readable content 

### **Typography** 

Use a strong display typeface for headings and a highly readable sans-serif for data-heavy interface elements. 

Possible pairing: 

- Display: Space Grotesk, Sora, or Manrope 

- Interface: DM Sans, IBM Plex Sans, or Plus Jakarta Sans 

### **Layout** 

- Left navigation sidebar 

- Top command bar 

- Main dashboard canvas 

- Right-side activity or AI panel 

- Dense but readable data cards 

- Strong use of status indicators 

## **Customer Dashboard Layout** 

```
+--------------------------------------------------+
```

```
| Logo | Search | Notifications | Profile |
+----------+---------------------------------------+
```

Semester Project — Full System Architecture 

Page 49 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

```
| Sidebar | Welcome back |
```

- `| | Summary cards | | | |` 

- `| | AI negotiation panel |` 

- `| | Active VM cards |` 

- `| | Usage and billing charts |` 

```
+----------+---------------------------------------+
```

## **Provider Dashboard Layout** 

Provider screens should prioritize: 

- Data density 

- Filters 

- Tables 

- Status indicators 

- Bulk actions 

- Audit visibility 

- Revenue and utilization metrics 

Semester Project — Full System Architecture 

Page 50 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

# **13. AI Chat Workspace Design** 

The AI chat screen should have three areas. 

## **Left Panel** 

- New conversation 

- Conversation history 

- Conversation status 

- Search conversations 

## **Center Panel** 

- Chat messages 

- Typing indicator 

- Suggested prompts 

- Input box 

- Attachment support, optional 

- Confirmation controls 

## **Right Panel** 

Live structured summary: 

```
Current Request
- CPU: 2 vCPU
- RAM: 4 GB
- Storage: 50 GB
- OS: Linux
- Duration: 30 days
- Billing: Monthly
- Estimated Price: $X
- Discount: 7%
```

This prevents customers from losing track of what the AI understood. 

## **Suggested Prompt Buttons** 

- `I need a server for a website` 

- `Show me the cheapest option` 

- `Compare monthly and hourly billing` 

- `Can I get a discount?` 

- `Upgrade my current VM` 

- `Explain my current bill` 

Semester Project — Full System Architecture 

Page 51 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

# **14. Animated Logo Design** 

## **Logo Concept: CloudPilot Orbit** 

### **Visual Idea** 

A stylized cloud containing a forward-facing navigation arrow or pilot compass. 

The logo represents: 

- Cloud infrastructure through the cloud shape. 

- AI guidance through the central intelligence node. 

- Negotiation and movement through an orbiting line. 

- Provisioning through the forward arrow. 

## **Logo Construction** 

```
curved orbit
/-------------\
[ CLOUD ] ---> forward arrow
\ * /
central node
```

## **Animation Sequence** 

### **On Page Load** 

**1.** Small central node appears. 

**2.** Orbit line draws around the cloud. 

**3.** Cloud shape fades and scales into place. 

**4.** Forward arrow slides into position. 

**5.** Logo settles with a subtle glow. 

### **During AI Processing** 

- Central node pulses. 

- Orbit rotates slowly. 

- Small particles move along the orbit. 

- The cloud remains stable. 

### **During Provisioning** 

- Cloud outline changes from amber to cyan. 

- Progress ring fills around the logo. 

- Arrow moves forward as provisioning advances. 

- On completion, the logo emits a short green pulse. 

Semester Project — Full System Architecture 

Page 52 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

### **During Error** 

- Orbit pauses. 

- Logo changes to amber or red. 

- A small warning pulse appears. 

- Avoid aggressive shaking because it creates poor usability. 

## **Reduced Motion Behavior** 

For users with reduced-motion settings: 

- Do not rotate the orbit. 

- Do not use pulsing effects. 

- Use static color changes and progress indicators. 

## **Logo Variants** 

- Full logo: icon plus CloudPilot 

- Compact logo: icon only 

- Loading logo: cloud plus progress orbit 

- AI logo: cloud plus central animated node 

- Provider logo: cloud plus control sliders 

- Customer logo: cloud plus forward arrow 

Semester Project — Full System Architecture 

Page 53 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

# **15. Notifications** 

## **Customer Notifications** 

- Offer ready 

- Offer expiring soon 

- VM provisioning started 

- VM ready 

- VM provisioning failed 

- VM stopped 

- Invoice generated 

- Payment due 

- Upgrade completed 

- Support ticket updated 

- Unusual usage detected 

## **Provider Notifications** 

- New customer 

- New deal 

- Deal requires approval 

- Provisioning failure 

- Failed billing cycle 

- Unpaid invoice 

- Unusual discount request 

- VM resource limit reached 

- Support escalation 

## **Notification Channels** 

For the semester project: 

- In-app notifications 

- Email simulation or real email integration 

Optional: 

- Browser notifications 

- SMS placeholder 

Semester Project — Full System Architecture 

Page 54 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

# **16. Error and Empty States** 

These are important for making the application appear complete. 

## **Empty States** 

- No active VMs 

- No invoices 

- No conversations 

- No pending offers 

- No support tickets 

- No customers 

- No pricing templates 

- No audit records 

Each empty state should include: 

- Explanation 

- Relevant action 

- Helpful illustration or icon 

- Clear next step 

## **Error States** 

- AI unavailable 

- Provisioning failed 

- Billing calculation failed 

- Unauthorized action 

- VM not found 

- Offer expired 

- Insufficient permissions 

- Network error 

- Session expired 

## **Example Offer Expired Message** 

_This offer expired on March 18, 2026. Start a new negotiation to receive an updated price._ 

Use exact dates and times in important system messages. 

Semester Project — Full System Architecture 

Page 55 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

# **17. Business Rules** 

## **Customer Rules** 

- A customer cannot access another customer's data. 

- A customer cannot modify provider pricing. 

- A customer cannot confirm an expired offer. 

- A customer cannot request unsupported VM resources. 

- A customer with a suspended billing account cannot provision new VMs. 

## **Provider Rules** 

- Only authorized provider users can change pricing. 

- Pricing changes require an audit log. 

- Existing orders retain their original pricing version. 

- Manual discounts require a reason. 

- Termination is irreversible after confirmation. 

## **Billing Rules** 

- Every active VM must have a billing relationship. 

- Every invoice must have line items. 

- Invoice totals must be recalculated on the backend. 

- Frontend-provided totals must never be trusted. 

- Usage records should be immutable after invoicing. 

- Billing adjustments require authorization. 

Semester Project — Full System Architecture 

Page 56 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

# **18. Security and Privacy** 

## **Authentication Security** 

- Secure password hashing. 

- Rate-limit login attempts. 

- Protect sessions. 

- Require authorization on every protected backend operation. 

- Use secure cookies. 

- Validate all request payloads. 

## **Data Protection** 

- Do not expose internal AI prompts. 

- Do not expose provider margin information to customers. 

- Do not expose customer records to other customers. 

- Minimize stored personal data. 

- Record administrative access. 

## **Important Attack Scenarios** 

The team should explicitly defend against: 

- Role manipulation. 

- IDOR attacks, such as changing a VM ID in a URL. 

- Forged price totals. 

- Forged discount values. 

- Replaying an accepted offer. 

- Confirming an expired offer. 

- Unauthorized provider actions. 

- Prompt injection. 

- Double-click order creation. 

- Duplicate billing records. 

Semester Project — Full System Architecture 

Page 57 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

# **19. Audit and Traceability** 

The system should be able to answer: 

- Who created this offer? 

- Which pricing rules were used? 

- What did the AI recommend? 

- What did the customer accept? 

- Who changed the deal? 

- When was the VM provisioned? 

- When did billing start? 

- Why was a VM terminated? 

- Who changed provider pricing? 

- What was the original and final configuration? 

_This is particularly valuable during project demonstrations because it shows real enterprise thinking._ 

Semester Project — Full System Architecture 

Page 58 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

# **20. Recommended MVP Scope** 

The project is ambitious. To protect the semester timeline, divide it into implementation levels. 

## **Level 1: Essential MVP** 

- Authentication 

- Customer dashboard 

- Provider dashboard 

- AI chat 

- Requirement extraction 

- VM templates 

- Pricing calculation 

- Discount limits 

- Offer creation 

- Order confirmation 

- Simulated VM provisioning 

- Start and stop VM 

- Basic usage tracking 

- Basic billing 

- Provider pricing management 

**Level 2: Strong Academic Project** 

- Upgrade workflow 

- Monthly, daily, hourly billing 

- Invoice generation 

- Audit logs 

- Negotiation policy editor 

- Deal review 

- Charts and analytics 

- Notifications 

- Provisioning failure simulation 

- Simulated terminal 

**Level 3: Advanced Features** 

- Provider staff roles 

- Support tickets 

- Multi-organization support 

- Promotional campaigns 

- Advanced discount rules 

- Real email notifications 

- Payment gateway sandbox 

Semester Project — Full System Architecture 

Page 59 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

- Resource availability simulation 

- AI workload recommendations 

- PDF invoice export 

- Real-time status updates 

Semester Project — Full System Architecture 

Page 60 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

# **21. Demonstration Scenario** 

For the final presentation, use a controlled storyline. 

## **Demo Story** 

**1.** Open the public CloudPilot landing page. 

**2.** Register as a customer. 

**3.** Start an AI conversation. 

**4.** Say: "I need a Linux server for a small web application for 30 days." 

**5.** AI asks about traffic and performance. **6.** Customer requests a discount. **7.** AI gives a discount within provider limits. **8.** Customer accepts the offer. **9.** Show order confirmation. **10.** Show simulated provisioning animation. **11.** VM becomes active. **12.** Open VM details. **13.** Start and stop the VM. **14.** Show changing usage. **15.** Show current estimated bill. **16.** Ask the AI to upgrade RAM. **17.** Accept the upgrade offer. **18.** Show VM resizing. **19.** Switch to provider dashboard. **20.** Show the deal and transcript. **21.** Show pricing rules. **22.** Show revenue and usage analytics. **23.** Show audit logs. **24.** Simulate a failed provisioning request. **25.** Show provider retrying the job. 

This demonstration proves the complete product cycle: 

```
Conversation -> Negotiation -> Order -> Provisioning -> Usage -> Billing -> Upgrade ->
Administration
```

Semester Project — Full System Architecture 

Page 61 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

# **22. Important Design Decisions** 

### **Decision 1: AI Does Not Own Business Logic** 

The AI proposes actions. The backend decides whether they are valid. 

### **Decision 2: Offers and Orders Are Separate** 

An offer can expire or be rejected. An order represents an accepted commitment. 

### **Decision 3: Pricing Is Versioned** 

Historical invoices must remain correct when the provider changes current prices. 

### **Decision 4: VM Operations Use an Adapter** 

The simulated VM provider can later be replaced with Proxmox or another infrastructure provider. 

### **Decision 5: Billing Is Event-Based** 

VM state changes such as start, stop, resize, and terminate should produce events. These events help calculate accurate usage. 

### **Decision 6: Every Administrative Action Is Audited** 

This provides transparency and makes the system feel production-oriented. 

Semester Project — Full System Architecture 

Page 62 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

# **23. Potential Project Risks** 

**Risk 1: AI Integration Becomes Too Unpredictable** 

**Solution:** Use structured outputs, backend validation, deterministic tools, and fallback forms. 

### **Risk 2: Billing Becomes Inconsistent** 

**Solution:** Centralize calculations in one billing service and write tests for every billing scenario. 

### **Risk 3: VM Simulation Looks Too Fake** 

**Solution:** Use realistic status transitions, provisioning delays, event logs, health states, simulated metrics, and a terminal interface. 

### **Risk 4: Scope Becomes Too Large** 

**Solution:** Implement the essential MVP first. Treat advanced modules as optional extensions. 

### **Risk 5: Provider Rules Are Not Enforced** 

**Solution:** Store policies in PostgreSQL and validate every AI-generated offer in the backend. 

### **Risk 6: UI Becomes Just a Chatbot** 

**Solution:** Build a complete cloud operations interface around the AI: VM cards, usage, invoices, provisioning events, policies, analytics, and audit logs. 

Semester Project — Full System Architecture 

Page 63 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

# **24. Final Product Positioning** 

This project should not be presented as simply: 

_A chatbot that rents servers._ 

That description is too small. 

The stronger positioning is: 

_CloudPilot is an AI-assisted cloud commerce and infrastructure automation platform that converts natural-language requirements into negotiated, validated, provisioned, monitored, and billed virtual infrastructure._ 

The project combines: 

- Conversational AI 

- Rule-based negotiation 

- Cloud resource modeling 

- Infrastructure lifecycle management 

- Usage metering 

- Automated billing 

- Role-based administration 

- Event and audit tracking 

- Provider/customer workflows 

- Infrastructure abstraction 

That combination gives the project strong academic and professional value. 

Semester Project — Full System Architecture 

Page 64 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 

# **25. Recommended Final Feature Set** 

For the best balance between ambition and feasibility, implement these features: 

**1.** Customer and provider authentication. 

**2.** Role-based dashboards. 

**3.** AI infrastructure requirement collection. 

**4.** AI pricing explanation. 

**5.** Rule-constrained discount negotiation. 

**6.** Offer creation and expiration. 

**7.** Order confirmation. 

**8.** Simulated VM provisioning. 

**9.** VM lifecycle controls. 

**10.** VM usage tracking. 

**11.** Hourly, daily, and monthly billing. 

**12.** Invoice generation. 

**13.** Upgrade negotiation. 

**14.** Provider pricing management. 

**15.** Negotiation policy management. 

**16.** Provider deal review. 

**17.** Revenue and usage analytics. 

**18.** Notifications. 

**19.** Audit logs. 

**20.** Failure and retry workflows. 

**21.** Animated CloudPilot branding. 

**22.** Responsive customer and provider interfaces. 

The strongest version of the project is not the one with the most screens. It is the one where every major workflow is connected correctly: 

```
Provider Rules
|
v
AI Negotiation
|
v
Validated Offer
|
v
Order
|
v
Simulated Provisioning
|
v
```

Semester Project — Full System Architecture 

Page 65 

**CloudPilot** 

AI-Powered Cloud Negotiation and Provisioning Portal 



<!-- Start of picture text -->
VM Lifecycle<br>|<br>v<br>Usage Metering<br>|<br>v<br>Billing<br>|<br>v<br>Upgrade or Termination<br>|<br>v<br>Audit and Analytics<br><!-- End of picture text -->

_That complete lifecycle should be the foundation of the website design and the central story of the semester project._ 

Semester Project — Full System Architecture 

Page 66 

