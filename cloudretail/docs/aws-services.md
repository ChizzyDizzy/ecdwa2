# AWS Services Verification Guide

This guide shows you how to verify each AWS service is running correctly from the AWS Console and CLI.

---

## Quick Access URLs

| Service | AWS Console URL |
|---------|-----------------|
| **EC2** | https://ap-southeast-1.console.aws.amazon.com/ec2/home?region=ap-southeast-1#Instances: |
| **RDS** | https://ap-southeast-1.console.aws.amazon.com/rds/home?region=ap-southeast-1#databases: |
| **ECR** | https://ap-southeast-1.console.aws.amazon.com/ecr/repositories?region=ap-southeast-1 |
| **VPC** | https://ap-southeast-1.console.aws.amazon.com/vpc/home?region=ap-southeast-1#vpcs: |
| **Security Groups** | https://ap-southeast-1.console.aws.amazon.com/ec2/home?region=ap-southeast-1#SecurityGroups: |
| **IAM** | https://console.aws.amazon.com/iam/home#/users |

---

## 1. EC2 (Elastic Compute Cloud)

### What it does
Hosts the Docker containers running all microservices.

### AWS Console
1. Go to **EC2 Dashboard** > **Instances**
2. Look for instance named `cloudretail-server`
3. Verify:
   - **Instance State**: `Running` (green)
   - **Status Checks**: `2/2 checks passed`
   - **Instance Type**: `t3.micro`
   - **Availability Zone**: `ap-southeast-1a` (or similar)
   - **Public IPv4 address**: Note this for accessing the app

### CLI Verification
```bash
# List EC2 instances
aws ec2 describe-instances \
  --region ap-southeast-1 \
  --filters "Name=tag:Name,Values=cloudretail-server" \
  --query "Reservations[].Instances[].{
    ID:InstanceId,
    State:State.Name,
    Type:InstanceType,
    PublicIP:PublicIpAddress,
    PrivateIP:PrivateIpAddress,
    AZ:Placement.AvailabilityZone
  }" --output table
```

### Expected Output
```
-----------------------------------------------------------------
|                      DescribeInstances                        |
+------+---------------+------------+-----------+---------------+
|  AZ  |      ID       | PrivateIP  | PublicIP  |    State      |
+------+---------------+------------+-----------+---------------+
| ap-southeast-1a | i-0abc123... | 172.31.x.x | 13.214.x.x | running |
+------+---------------+------------+-----------+---------------+
```

### What to show in viva
- Instance is running
- Public IP is accessible
- Instance type is t3.micro (free tier)

---

## 2. RDS (Relational Database Service)

### What it does
Hosts PostgreSQL database with 5 separate databases for each microservice.

### AWS Console
1. Go to **RDS Dashboard** > **Databases**
2. Look for `cloudretail-db`
3. Verify:
   - **Status**: `Available` (green)
   - **Engine**: `PostgreSQL 15.x`
   - **Instance Class**: `db.t3.micro`
   - **Multi-AZ**: `No` (free tier)
   - **Storage**: `20 GiB`

### CLI Verification
```bash
# Describe RDS instance
aws rds describe-db-instances \
  --region ap-southeast-1 \
  --db-instance-identifier cloudretail-db \
  --query "DBInstances[].{
    ID:DBInstanceIdentifier,
    Status:DBInstanceStatus,
    Engine:Engine,
    Version:EngineVersion,
    Class:DBInstanceClass,
    Storage:AllocatedStorage,
    Endpoint:Endpoint.Address,
    AZ:AvailabilityZone
  }" --output table
```

### Verify databases exist
```bash
# From your local machine or EC2
docker run --rm -e PGPASSWORD=CloudRetail2026db postgres:15-alpine \
  psql -h cloudretail-db.cjy40oge00uf.ap-southeast-1.rds.amazonaws.com \
  -U postgres -c "\l" | grep cloudretail
```

### Expected Output
```
cloudretail_users      | postgres | UTF8
cloudretail_products   | postgres | UTF8
cloudretail_orders     | postgres | UTF8
cloudretail_inventory  | postgres | UTF8
cloudretail_payments   | postgres | UTF8
```

### What to show in viva
- Single RDS instance (free tier limitation)
- 5 logically separated databases (database-per-service pattern)
- PostgreSQL 15 engine
- Endpoint URL for connection

---

## 3. ECR (Elastic Container Registry)

### What it does
Private Docker image registry storing all 8 service images.

### AWS Console
1. Go to **ECR** > **Repositories**
2. Look for repositories starting with `cloudretail/`
3. Verify each repository has images pushed

### CLI Verification
```bash
# List all repositories
aws ecr describe-repositories \
  --region ap-southeast-1 \
  --query "repositories[?starts_with(repositoryName, 'cloudretail')].{
    Name:repositoryName,
    URI:repositoryUri
  }" --output table

# Check images in a repository
aws ecr list-images \
  --region ap-southeast-1 \
  --repository-name cloudretail/api-gateway \
  --query "imageIds[].imageTag" --output table
```

### Expected Repositories
```
cloudretail/api-gateway
cloudretail/user-service
cloudretail/product-service
cloudretail/order-service
cloudretail/inventory-service
cloudretail/payment-service
cloudretail/event-bus
cloudretail/frontend
```

### What to show in viva
- 8 Docker images stored privately
- Images are versioned with tags
- EC2 pulls images from ECR on deployment

---

## 4. VPC (Virtual Private Cloud)

### What it does
Provides network isolation for EC2 and RDS instances.

### AWS Console
1. Go to **VPC Dashboard** > **Your VPCs**
2. Note the default VPC or custom `cloudretail-vpc`
3. Check **Subnets** - should have multiple availability zones

### CLI Verification
```bash
# List VPCs
aws ec2 describe-vpcs \
  --region ap-southeast-1 \
  --query "Vpcs[].{
    VpcId:VpcId,
    CIDR:CidrBlock,
    IsDefault:IsDefault
  }" --output table

# List Subnets
aws ec2 describe-subnets \
  --region ap-southeast-1 \
  --query "Subnets[].{
    SubnetId:SubnetId,
    AZ:AvailabilityZone,
    CIDR:CidrBlock
  }" --output table
```

### What to show in viva
- Network isolation for security
- Multiple subnets across availability zones
- CIDR block allocation

---

## 5. Security Groups

### What it does
Acts as a virtual firewall controlling inbound/outbound traffic.

### AWS Console
1. Go to **EC2** > **Security Groups**
2. Look for:
   - `cloudretail-ec2-sg` (EC2 instance)
   - `cloudretail-rds-sg` (RDS database)

### CLI Verification
```bash
# List security groups
aws ec2 describe-security-groups \
  --region ap-southeast-1 \
  --filters "Name=group-name,Values=cloudretail-*" \
  --query "SecurityGroups[].{
    Name:GroupName,
    ID:GroupId,
    Description:Description
  }" --output table

# Show inbound rules
aws ec2 describe-security-groups \
  --region ap-southeast-1 \
  --filters "Name=group-name,Values=cloudretail-ec2-sg" \
  --query "SecurityGroups[].IpPermissions[].{
    Protocol:IpProtocol,
    FromPort:FromPort,
    ToPort:ToPort,
    Source:IpRanges[0].CidrIp
  }" --output table
```

### Expected Rules

**EC2 Security Group (cloudretail-ec2-sg)**:
| Port | Protocol | Source | Purpose |
|------|----------|--------|---------|
| 22 | TCP | Your IP | SSH access |
| 3000 | TCP | 0.0.0.0/0 | Frontend |
| 8080 | TCP | 0.0.0.0/0 | API Gateway |

**RDS Security Group (cloudretail-rds-sg)**:
| Port | Protocol | Source | Purpose |
|------|----------|--------|---------|
| 5432 | TCP | EC2 SG / 0.0.0.0/0 | PostgreSQL |

### What to show in viva
- Principle of least privilege
- Only necessary ports are open
- RDS only accessible from EC2 (ideally)

---

## 6. IAM (Identity and Access Management)

### What it does
Controls who can access AWS resources and what actions they can perform.

### AWS Console
1. Go to **IAM** > **Users**
2. Check your user's permissions
3. Go to **Roles** - check if EC2 role exists for ECR access

### CLI Verification
```bash
# Show current identity
aws sts get-caller-identity

# List attached policies for current user
aws iam list-attached-user-policies \
  --user-name YOUR_USERNAME

# List EC2 instance profiles (if using IAM role for ECR)
aws iam list-instance-profiles \
  --query "InstanceProfiles[?contains(InstanceProfileName, 'cloudretail')].{
    Name:InstanceProfileName,
    Roles:Roles[].RoleName
  }" --output table
```

### What to show in viva
- Separate IAM user (not root account)
- Minimal permissions principle
- EC2 instance role for ECR access (if configured)

---

## 7. Verify Application is Running

### From EC2 Instance
```bash
# SSH into EC2
ssh -i your-key.pem ec2-user@YOUR_EC2_PUBLIC_IP

# Check containers
docker-compose ps

# Check all healthy
docker-compose ps --format "table {{.Name}}\t{{.Status}}"

# Test API
curl http://localhost:8080/health
```

### From Your Browser
- **Frontend**: `http://YOUR_EC2_PUBLIC_IP:3000`
- **API Health**: `http://YOUR_EC2_PUBLIC_IP:8080/health`

### From Your Local Machine
```bash
export EC2_IP="YOUR_EC2_PUBLIC_IP"

# Health check
curl http://$EC2_IP:8080/health

# Register user
curl -s -X POST http://$EC2_IP:8080/api/users/register \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Test","lastName":"User","email":"test@example.com","password":"Password123","role":"admin","gdprConsent":true}'

# List products
curl http://$EC2_IP:8080/api/products/products
```

---

## 8. Cost Monitoring

### AWS Console
1. Go to **Billing Dashboard**
2. Check **Free Tier Usage**
3. Verify you're within limits

### Free Tier Limits
| Service | Free Tier Limit | Your Usage |
|---------|-----------------|------------|
| EC2 t3.micro | 750 hours/month | Check dashboard |
| RDS db.t3.micro | 750 hours/month | Check dashboard |
| ECR | 500 MB/month storage | Check dashboard |
| Data Transfer | 15 GB/month outbound | Check dashboard |

### CLI Check
```bash
# This requires Cost Explorer API access
aws ce get-cost-and-usage \
  --time-period Start=2026-02-01,End=2026-02-28 \
  --granularity MONTHLY \
  --metrics "UnblendedCost" \
  --group-by Type=DIMENSION,Key=SERVICE
```

---

## Quick Checklist for Viva

- [ ] EC2 instance running (green status)
- [ ] RDS database available (green status)
- [ ] All 8 ECR repositories have images
- [ ] Security groups configured correctly
- [ ] Can access frontend at `http://EC2_IP:3000`
- [ ] Can access API at `http://EC2_IP:8080/health`
- [ ] Can register/login users
- [ ] Can create products (as admin)
- [ ] Can view products list
- [ ] Free tier usage within limits

---

## Troubleshooting

### EC2 not accessible
```bash
# Check security group allows your IP
aws ec2 describe-security-groups --group-names cloudretail-ec2-sg

# Check instance is running
aws ec2 describe-instance-status --instance-ids YOUR_INSTANCE_ID
```

### RDS connection refused
```bash
# Check RDS is available
aws rds describe-db-instances --db-instance-identifier cloudretail-db

# Check security group allows EC2
# Verify DB_SSL=true in environment
```

### Containers not starting
```bash
# SSH into EC2
docker-compose logs SERVICE_NAME
docker-compose ps
```

---

*COMP60010 - Enterprise Cloud and Distributed Web Applications*
