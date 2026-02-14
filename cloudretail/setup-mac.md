# MacOS Setup Guide

If you already have the project running on Windows and want to set it up on your Mac, here's what you need to do.

## Prerequisites

### 1. Install Homebrew (if you don't have it)
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 2. Install Node.js
```bash
brew install node
node --version  # Should be v18 or higher
```

### 3. Install Docker Desktop for Mac
Download from: https://www.docker.com/products/docker-desktop/

After installing, open Docker Desktop and make sure it's running (you'll see the whale icon in your menu bar).

### 4. Install Git (usually pre-installed)
```bash
git --version
```

### 5. Install AWS CLI
```bash
brew install awscli
aws --version
```

## Clone the Repository

```bash
cd ~/Documents  # or wherever you want to put it
git clone https://github.com/ChizzyDizzy/ecdwa2.git
cd ecdwa2/cloudretail
```

## Configure AWS Credentials

Since you already have an AWS account set up on Windows, you just need to configure the same credentials on Mac:

```bash
aws configure
```

Enter the same values you used on Windows:
- AWS Access Key ID
- AWS Secret Access Key
- Default region: `ap-southeast-1`
- Default output format: `json`

To verify it worked:
```bash
aws sts get-caller-identity
```

## Local Development Setup

### Install dependencies
```bash
npm install
```

### Start everything with Docker
```bash
docker-compose up -d
```

Check if everything is running:
```bash
docker-compose ps
```

### Access the application
- Frontend: http://localhost:8080
- API: http://localhost:3000
- Health check: http://localhost:3000/health

## Connect to Your AWS Deployment

If you want to access the EC2 instance you deployed from Windows:

### 1. Copy your SSH key to Mac

From your Windows machine, copy the key file to your Mac (use USB drive, email, or cloud storage).

Place it in `~/.ssh/` on your Mac:
```bash
mkdir -p ~/.ssh
mv ~/Downloads/cloudretail-key.pem ~/.ssh/
chmod 400 ~/.ssh/cloudretail-key.pem
```

### 2. SSH into EC2

```bash
ssh -i ~/.ssh/cloudretail-key.pem ec2-user@YOUR_EC2_IP
```

Replace `YOUR_EC2_IP` with the actual IP from your AWS console.

## Working with ECR (if you need to push new images)

### Login to ECR
```bash
aws ecr get-login-password --region ap-southeast-1 | \
  docker login --username AWS --password-stdin \
  850874728684.dkr.ecr.ap-southeast-1.amazonaws.com
```

### Build and push (example for frontend)
```bash
cd frontend
docker build -t cloudretail/frontend:latest .
docker tag cloudretail/frontend:latest \
  850874728684.dkr.ecr.ap-southeast-1.amazonaws.com/cloudretail/frontend:latest
docker push 850874728684.dkr.ecr.ap-southeast-1.amazonaws.com/cloudretail/frontend:latest
```

## Running Tests

```bash
npm test
```

## Common Mac-Specific Issues

### Docker not starting?
- Make sure Docker Desktop is running (check menu bar)
- You might need to allocate more memory to Docker:
  - Open Docker Desktop
  - Go to Settings > Resources
  - Increase Memory to at least 4GB

### Port already in use?
Check what's using the port:
```bash
lsof -i :3000  # or whatever port
```

Kill it if needed:
```bash
kill -9 <PID>
```

### Permission denied on SSH key?
```bash
chmod 400 ~/.ssh/cloudretail-key.pem
```

## Helpful Mac Shortcuts

Instead of using Git Bash like on Windows, you'll use Terminal. Some helpful commands:

```bash
# Open current directory in Finder
open .

# Clear terminal
cmd + K

# View hidden files in Finder
cmd + shift + .
```

## VS Code on Mac

If you're using VS Code, install it with Homebrew:
```bash
brew install --cask visual-studio-code
```

Then open the project:
```bash
code .
```

That's it! Your Mac setup should match your Windows environment now.
