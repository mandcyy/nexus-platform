terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
    kubernetes = { source = "hashicorp/kubernetes", version = "~> 2.25" }
    helm = { source = "hashicorp/helm", version = "~> 2.12" }
  }
  backend "s3" {
    bucket = "nexus-platform-terraform-state"
    key    = "production/terraform.tfstate"
    region = "ap-southeast-1"
    encrypt = true
  }
}

provider "aws" { region = var.aws_region }

module "vpc" {
  source = "../modules/vpc"
  name   = "nexus-vpc"
  cidr   = "10.0.0.0/16"
  azs    = ["ap-southeast-1a", "ap-southeast-1b", "ap-southeast-1c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
}

module "eks" {
  source          = "../modules/eks"
  cluster_name    = "nexus-platform"
  cluster_version = "1.29"
  vpc_id          = module.vpc.vpc_id
  subnet_ids      = module.vpc.private_subnets
  node_groups = {
    general = {
      desired_size = 5
      max_size     = 50
      min_size     = 3
      instance_types = ["c6a.xlarge", "c7a.xlarge"]
      capacity_type   = "ON_DEMAND"
    }
    ai = {
      desired_size   = 2
      max_size       = 10
      min_size       = 1
      instance_types = ["g5.xlarge"]
      capacity_type  = "SPOT"
    }
    messaging = {
      desired_size   = 8
      max_size       = 100
      min_size       = 5
      instance_types = ["m6a.large", "m7a.large"]
      capacity_type   = "ON_DEMAND"
    }
  }
}

module "rds" {
  source         = "../modules/rds"
  identifier     = "nexus-postgres"
  engine         = "postgres"
  engine_version = "16.2"
  instance_class = "db.r6g.xlarge"
  storage        = 500
  max_storage    = 5000
  multi_az       = true
  subnet_ids     = module.vpc.private_subnets
  vpc_id         = module.vpc.vpc_id
}

module "elasticache" {
  source         = "../modules/elasticache"
  cluster_id     = "nexus-redis"
  engine         = "redis"
  node_type      = "cache.r6g.large"
  num_cache_nodes = 6
  subnet_ids     = module.vpc.private_subnets
}

module "opensearch" {
  source          = "../modules/opensearch"
  domain_name     = "nexus-search"
  engine_version  = "OpenSearch_2.11"
  instance_type   = "r6g.large.search"
  instance_count  = 6
  ebs_volume_size = 500
  subnet_ids      = module.vpc.private_subnets
}

module "cdn" {
  source      = "../modules/cloudfront"
  origin_domain = "nexus-media.s3.amazonaws.com"
  price_class = "PriceClass_All"
}

resource "aws_s3_bucket" "media" {
  bucket = "nexus-media-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_versioning" "media" {
  bucket = aws_s3_bucket.media.id
  versioning_configuration { status = "Enabled" }
}

data "aws_caller_identity" "current" {}

output "eks_cluster_endpoint" { value = module.eks.cluster_endpoint }
output "rds_endpoint" { value = module.rds.endpoint }
output "redis_endpoint" { value = module.elasticache.endpoint }