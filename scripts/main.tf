provider "aws" {
  region = var.aws_region
}

terraform {
  backend "s3" {
    bucket = "verinode-terraform-state"
    key    = "state/terraform.tfstate"
    region = "us-east-1"
  }
}

resource "aws_vpc" "verinode_vpc" {
  cidr_block = "10.0.0.0/16"
  
  tags = {
    Name = "verinode-vpc"
    Environment = var.environment
  }
}

resource "aws_security_group" "web_sg" {
  name        = "verinode-web-sg"
  description = "Allow inbound traffic"
  vpc_id      = aws_vpc.verinode_vpc.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}