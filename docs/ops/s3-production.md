# S3 Production Provisioning Runbook

## Amaç

Naro medya yüklemeleri için **2 bucket + CloudFront + IAM + CORS + lifecycle + versioning** altyapısı kurulumu. V1 LocalStack dev'e tam paralel; prod'da AWS hesabı üzerinden Terraform apply.

Bu runbook **DevOps elle çalıştırır**. Backend kod değişikliği yok; çıktı olarak `.env.production`'da kullanılacak env değerleri üretilir.

---

## 1. Gereksinimler

- AWS hesabı (root değil; IAM admin)
- AWS CLI konfigüre
- Terraform >= 1.6
- Alan adı: `cdn.naro.com.tr` (Route 53 veya CloudFront default)
- ACM SSL sertifikası `us-east-1` bölgesinde (CloudFront SSL şartı)

---

## 2. Bucket yapısı

| Bucket | Visibility | CloudFront | Erişim |
|---|---|---|---|
| `naro-media-private-prod` | PRIVATE | ❌ | Backend presigned GET (15dk TTL) + IAM role |
| `naro-media-public-prod` | PUBLIC (OAI) | ✅ `cdn.naro.com.tr` | CloudFront OAI bucket policy; direct public URL yok |

---

## 3. Terraform şablon

```hcl
# terraform/media/main.tf

variable "aws_region" { default = "eu-central-1" }
variable "cdn_domain" { default = "cdn.naro.com.tr" }
variable "acm_certificate_arn" {}  # us-east-1

provider "aws" {
  region = var.aws_region
}

# Private bucket
resource "aws_s3_bucket" "private" {
  bucket = "naro-media-private-prod"
  force_destroy = false
}

resource "aws_s3_bucket_versioning" "private" {
  bucket = aws_s3_bucket.private.id
  versioning_configuration {
    status = "Enabled"  # 30g accident recovery
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "private" {
  bucket = aws_s3_bucket.private.id

  rule {
    id     = "abort-multipart"
    status = "Enabled"
    abort_incomplete_multipart_upload { days_after_initiation = 1 }
  }

  rule {
    id     = "version-retention"
    status = "Enabled"
    noncurrent_version_expiration { noncurrent_days = 30 }
  }

  rule {
    id     = "pending-prefix-purge"
    status = "Enabled"
    filter { prefix = "pending/" }
    expiration { days = 1 }  # ARQ orphan_purge primary; lifecycle safety net
  }
}

resource "aws_s3_bucket_public_access_block" "private" {
  bucket                  = aws_s3_bucket.private.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_cors_configuration" "private" {
  bucket = aws_s3_bucket.private.id

  cors_rule {
    allowed_methods = ["PUT"]
    allowed_origins = ["https://app.naro.com.tr", "https://service.naro.com.tr"]
    allowed_headers = ["*"]
    expose_headers  = ["ETag"]  # Multipart (V2) için zorunlu
    max_age_seconds = 3600
  }
}

# Public bucket
resource "aws_s3_bucket" "public" {
  bucket = "naro-media-public-prod"
}

resource "aws_s3_bucket_public_access_block" "public" {
  bucket                  = aws_s3_bucket.public.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CloudFront OAI
resource "aws_cloudfront_origin_access_identity" "public" {
  comment = "naro public media OAI"
}

data "aws_iam_policy_document" "public_bucket_policy" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.public.arn}/*"]
    principals {
      type        = "AWS"
      identifiers = [aws_cloudfront_origin_access_identity.public.iam_arn]
    }
  }
}

resource "aws_s3_bucket_policy" "public" {
  bucket = aws_s3_bucket.public.id
  policy = data.aws_iam_policy_document.public_bucket_policy.json
}

resource "aws_cloudfront_distribution" "public" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = ""
  aliases             = [var.cdn_domain]

  origin {
    domain_name = aws_s3_bucket.public.bucket_regional_domain_name
    origin_id   = "public-s3"
    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.public.cloudfront_access_identity_path
    }
  }

  default_cache_behavior {
    target_origin_id       = "public-s3"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }
    min_ttl     = 0
    default_ttl = 86400
    max_ttl     = 31536000
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  viewer_certificate {
    acm_certificate_arn      = var.acm_certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
}

# Backend presign-only IAM
resource "aws_iam_user" "backend" {
  name = "naro-backend-media"
}

resource "aws_iam_access_key" "backend" {
  user = aws_iam_user.backend.name
}

data "aws_iam_policy_document" "backend_policy" {
  statement {
    actions = [
      "s3:PutObject",
      "s3:GetObject",
      "s3:DeleteObject",
      "s3:ListBucket",
      "s3:GetObjectVersion",
    ]
    resources = [
      aws_s3_bucket.private.arn,
      "${aws_s3_bucket.private.arn}/*",
      aws_s3_bucket.public.arn,
      "${aws_s3_bucket.public.arn}/*",
    ]
  }
}

resource "aws_iam_user_policy" "backend" {
  name   = "naro-backend-media-policy"
  user   = aws_iam_user.backend.name
  policy = data.aws_iam_policy_document.backend_policy.json
}

# Output env vars
output "env" {
  sensitive = true
  value = {
    AWS_REGION                 = var.aws_region
    AWS_ACCESS_KEY_ID          = aws_iam_access_key.backend.id
    AWS_SECRET_ACCESS_KEY      = aws_iam_access_key.backend.secret
    S3_PRIVATE_BUCKET          = aws_s3_bucket.private.id
    S3_PUBLIC_BUCKET           = aws_s3_bucket.public.id
    CLOUDFRONT_PUBLIC_BASE_URL = "https://${var.cdn_domain}"
    AWS_S3_ENDPOINT_URL        = ""  # LocalStack dev dışı — prod boş
  }
}
```

---

## 4. Apply prosedürü

```bash
cd terraform/media
terraform init
terraform plan -var="acm_certificate_arn=arn:aws:acm:us-east-1:ACCOUNT:certificate/..."
terraform apply

# Output env'i `.env.production`'a taşı:
terraform output -json env | jq -r 'to_entries[] | "\(.key)=\(.value)"' > .env.production
```

Route 53:
```bash
aws route53 change-resource-record-sets --hosted-zone-id ZXX \
  --change-batch '{"Changes":[{"Action":"UPSERT","ResourceRecordSet":{"Name":"cdn.naro.com.tr","Type":"A","AliasTarget":{"HostedZoneId":"Z2FDTNDATAQYW2","DNSName":"d123abc.cloudfront.net","EvaluateTargetHealth":false}}}]}'
```

---

## 5. Smoke test

```bash
# Backend (.env.production)
curl -X POST https://api.naro.com.tr/api/v1/media/uploads/intents \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"purpose":"user_avatar","owner_ref":"user:...","filename":"test.jpg","mime_type":"image/jpeg","size_bytes":102400}'

# Response'tan presigned upload_url al, PUT:
curl -X PUT "$UPLOAD_URL" -H "Content-Type: image/jpeg" --data-binary @test.jpg

# Complete:
curl -X POST https://api.naro.com.tr/api/v1/media/uploads/$UPLOAD_ID/complete \
  -H "Authorization: Bearer $TOKEN" -d '{}'

# CloudFront public URL erişilebilir mi:
curl -I https://cdn.naro.com.tr/public/user/user:...../user_avatar/...../original.jpg
```

---

## 6. Izleme

- CloudWatch: S3 bucket size + request count
- CloudFront: cache hit ratio + 4xx ratio
- Backend `/metrics`:
  - `naro_media_upload_intent_total{purpose}`
  - `naro_media_upload_complete_total{purpose,status}`
  - `naro_media_orphan_purged_total`
  - `naro_media_retention_deleted_total{purpose}`

---

## 7. Rollback

```bash
terraform destroy  # Bucket'ları + CloudFront + IAM user siler
```

Versioning sayesinde accident silmeler 30g geri getirilir:
```bash
aws s3api list-object-versions --bucket naro-media-private-prod --prefix private/...
aws s3api get-object --bucket ... --key ... --version-id ...
```

---

## 8. Maliyet (AWS kalkülatör — US East-1 price, ~EU Frankfurt benzer)

- S3 Standard storage (1TB): ~$23/ay
- PUT/GET istek (1M): $5 / $0.4
- CloudFront transfer (1TB out): ~$85
- Tahmini aylık erken lansman: ~$50-100 (100GB medya, 100K isteğe)

V2'de S3 Intelligent-Tiering + CloudFront reserved capacity optimize edilir.
