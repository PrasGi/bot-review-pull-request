// bot-review-pull-request (bot-review.prasme.id)
// VPS: /projects/bot-review-pull-request
// No seed stage: the production image ships only .next/standalone, so tsx and
// scripts/ are absent. Seeding is a one-off run from a workstation.

pipeline {
    agent any

    environment {
        APP_NAME   = 'bot-review-pull-request'
        PORT       = '3290'
        DEPLOY_DIR = '/projects/bot-review-pull-request'
        APP_URL    = 'https://bot-review.prasme.id'
    }

    stages {
        stage('Checkout') {
            steps {
                echo 'Checking out code...'
                checkout scm
            }
        }

        stage('Copy Source') {
            steps {
                echo 'Copying source to deployment directory...'
                sh '''
                    mkdir -p ${DEPLOY_DIR}
                    rsync -av --delete \
                        --exclude='.git' \
                        --exclude='node_modules' \
                        --exclude='.next' \
                        --exclude='.env' \
                        ./ ${DEPLOY_DIR}/
                '''
            }
        }

        stage('Setup Environment') {
            steps {
                echo 'Creating .env from credentials...'
                withCredentials([
                    string(credentialsId: 'bot-review-pull-request-mongodb-uri',           variable: 'MONGODB_URI'),
                    string(credentialsId: 'bot-review-pull-request-github-app-id',         variable: 'GITHUB_APP_ID'),
                    string(credentialsId: 'bot-review-pull-request-github-app-slug',       variable: 'GITHUB_APP_SLUG'),
                    string(credentialsId: 'bot-review-pull-request-github-client-id',      variable: 'GITHUB_CLIENT_ID'),
                    string(credentialsId: 'bot-review-pull-request-github-client-secret',  variable: 'GITHUB_CLIENT_SECRET'),
                    string(credentialsId: 'bot-review-pull-request-github-webhook-secret', variable: 'GITHUB_WEBHOOK_SECRET'),
                    string(credentialsId: 'bot-review-pull-request-token-encryption-key',  variable: 'TOKEN_ENCRYPTION_KEY'),
                    string(credentialsId: 'bot-review-pull-request-session-secret',        variable: 'SESSION_SECRET'),
                    string(credentialsId: 'bot-review-pull-request-cron-secret',           variable: 'CRON_SECRET'),
                    string(credentialsId: 'bot-review-pull-request-glm-api-key',           variable: 'GLM_API_KEY')
                ]) {
                    sh '''
                        umask 077
                        cat > ${DEPLOY_DIR}/.env << EOF
MONGODB_URI=${MONGODB_URI}
MONGODB_DB_NAME=pr_reviewer

GITHUB_APP_ID=${GITHUB_APP_ID}
GITHUB_APP_SLUG=${GITHUB_APP_SLUG}
GITHUB_CLIENT_ID=${GITHUB_CLIENT_ID}
GITHUB_CLIENT_SECRET=${GITHUB_CLIENT_SECRET}
GITHUB_WEBHOOK_SECRET=${GITHUB_WEBHOOK_SECRET}

TOKEN_ENCRYPTION_KEY=${TOKEN_ENCRYPTION_KEY}
SESSION_SECRET=${SESSION_SECRET}
CRON_SECRET=${CRON_SECRET}

APP_URL=${APP_URL}

GLM_API_KEY=${GLM_API_KEY}
GLM_BASE_URL=https://api.z.ai/api/coding/paas/v4/

NODE_ENV=production
EOF
                        echo ".env created"
                    '''
                }
            }
        }

        stage('Build') {
            steps {
                echo 'Building Docker image...'
                sh '''
                    cd ${DEPLOY_DIR}
                    docker compose build --no-cache
                '''
            }
        }

        stage('Deploy') {
            steps {
                echo 'Deploying...'
                sh '''
                    cd ${DEPLOY_DIR}
                    docker compose up -d --force-recreate
                '''
            }
        }

        stage('Health Check') {
            steps {
                echo 'Health check...'
                sh '''
                    sleep 15
                    if ! docker ps --format '{{.Names}}' | grep -qx "${APP_NAME}"; then
                        echo "App container not running"
                        docker logs ${APP_NAME} --tail 50
                        exit 1
                    fi
                    for i in 1 2 3 4 5 6; do
                        if curl -sf http://localhost:${PORT}/api/health; then
                            echo "App healthy"
                            exit 0
                        fi
                        if [ "$i" = "6" ]; then
                            echo "Health check failed"
                            docker logs ${APP_NAME} --tail 100
                            exit 1
                        fi
                        sleep 5
                    done
                '''
            }
        }

        stage('Cleanup') {
            steps {
                sh 'docker image prune -f'
            }
        }

        stage('Reload Nginx') {
            steps {
                sh 'docker exec nginx nginx -t && docker exec nginx nginx -s reload'
            }
        }
    }

    post {
        success {
            echo 'bot-review-pull-request deployment successful.'
            sh 'docker ps --filter "name=${APP_NAME}"'
        }
        failure {
            echo 'Deployment failed.'
            sh 'docker logs ${APP_NAME} --tail 100 2>/dev/null || true'
        }
    }
}
