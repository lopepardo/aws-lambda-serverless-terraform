terraform {
  backend "s3" {
    key          = "lambda-serverless/dev/statefile.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true # Activates S3 native state locking
  }
}