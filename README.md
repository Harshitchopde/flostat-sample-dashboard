# Flostat Sample Dashboard

# 🚀 React Frontend for IoT Monitoring System

This project is a React-based frontend to monitor pump status using AWS IoT Core. It connects to AWS services using Cognito for authentication and MQTT over WebSocket for real-time communication.

---

## 🖥️ Local Development Setup

### 1. 📦 Clone the Repository

```bash
git clone https://github.com/Harshitchopde/flostat-sample-dashboard.git
cd flostat-sample-dashboard

npm install
# or
yarn install

cp .env.example .env

REACT_APP_IOT_ENDPOINT=your-iot-endpoint.amazonaws.com
REACT_APP_AWS_REGION=your-aws-region
REACT_APP_COGNITO_IDENTITY_POOL_ID=your-cognito-identity-pool-id
