-- EXTENSÕES OBRIGATÓRIAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ENUMS

CREATE TYPE generic_status AS ENUM ('active', 'inactive', 'pending', 'blocked', 'deleted', 'approved', 'archived', 'available', 'cancelled', 'closed', 'completed', 'confirmed', 'denied', 'disabled', 'draft', 'expired', 'failed', 'fraud_suspected', 'in_progress', 'incomplete', 'invalid', 'manual_override', 'on_hold', 'ongoing', 'paid', 'paused', 'processing', 'refunded', 'rejected', 'returned', 'revalidated', 'reversed', 'scheduled', 'submitted', 'suspended', 'unavailable', 'under_review', 'waiting_confirmation', 'unspecified', 'internal_policy', 'external_request');
CREATE TYPE ticket_status AS ENUM ('open', 'in_progress', 'closed', 'cancelled', 'expired', 'issued', 'lost', 'pending_payment', 'reassigned', 'recovered', 'redeemed', 'reserved', 'scanned', 'used');
CREATE TYPE delivery_status AS ENUM ('pending', 'in_transit', 'delivered', 'cancelled', 'awaiting_pickup', 'confirmed', 'delivery_failed', 'driver_arrived', 'driver_assigned', 'driver_en_route', 'failed_attempt', 'out_for_delivery', 'package_collected', 'rescheduled', 'returned', 'returning');
CREATE TYPE bid_status AS ENUM ('valid', 'invalid', 'withdrawn', 'winning', 'losing');
CREATE TYPE action_reason_code AS ENUM ('user_request', 'provider_request', 'system_error', 'invalid_input', 'missing_information', 'policy_violation', 'fraud_suspected', 'identity_mismatch', 'manual_adjustment', 'verification_failed', 'unavailable_item', 'delayed', 'no_show', 'duplicate', 'cancelled_by_user', 'cancelled_by_provider', 'billing_error', 'payment_failed', 'unauthorized_use', 'other', 'ban', 'payment_issue', 'technical_error', 'item_unavailable', 'schedule_conflict', 'weather_conditions', 'system_cancellation', 'unauthorized_transaction', 'item_not_received', 'not_as_described', 'duplicate_charge', 'late_delivery', 'invalid_transaction');
CREATE TYPE balance_reason AS ENUM ('purchase', 'refund', 'adjustment', 'commission', 'bonus', 'transfer', 'withdrawal', 'manual_deposit');
CREATE TYPE generic_reason AS ENUM ('user_action', 'admin_action', 'system_update', 'manual_change', 'import', 'export', 'correction', 'migration', 'merge', 'split', 'data_cleanup', 'other');
CREATE TYPE account_financial_type AS ENUM ('wallet', 'income', 'platform_fee', 'cashback', 'region_pool', 'credit', 'personal', 'business', 'affiliate', 'provider', 'campaign', 'temporary', 'reward_pool');
CREATE TYPE account_type AS ENUM ('individual', 'company', 'franchise', 'cooperative', 'ngo', 'public_entity', 'association', 'informal_group');
CREATE TYPE activity_action AS ENUM ('create', 'update', 'delete', 'login', 'logout', 'send_notification', 'process_transaction', 'manual_override', 'system_check', 'sync_external_service', 'schedule_event', 'cancel');
CREATE TYPE employee_cost_type AS ENUM ('salary', 'benefits', 'taxes', 'bonus', 'commission', 'overtime', 'allowance', 'other');
CREATE TYPE activity_type AS ENUM ('auth', 'profile', 'user_management', 'notification', 'document', 'finance', 'transaction', 'schedule', 'integration', 'support', 'content');
CREATE TYPE address_type AS ENUM ('residential', 'commercial', 'billing', 'shipping', 'delivery');
CREATE TYPE admin_permission_level AS ENUM ('view', 'create', 'edit', 'delete', 'approve', 'export', 'assign', 'full_access');
CREATE TYPE admin_role AS ENUM ('super_admin', 'moderator', 'auditor', 'support_agent', 'regional_manager', 'financial_analyst', 'compliance_officer', 'content_moderator', 'system_operator');
CREATE TYPE app_module AS ENUM ('services', 'store', 'events', 'delivery', 'rentals', 'rides', 'transport', 'food', 'marketplace', 'projects', 'voting', 'unifybank', 'support', 'notifications', 'health', 'education', 'culture', 'pets');
CREATE TYPE biological_sex AS ENUM ('male', 'female');
CREATE TYPE business_interest AS ENUM ('live_music', 'craft_beer', 'nightlife', 'karaoke', 'games', 'arcade', 'pool_table', 'skate', 'kart', 'paintball', 'cinema', 'open_air', 'pet_friendly', 'vegan_friendly', 'book_friendly', 'romantic', 'family_friendly', 'lgbtqia_friendly', 'social_impact', 'local_art', 'handmade', 'tech_events', 'sport_transmission');
CREATE TYPE card_brand AS ENUM ('visa', 'mastercard', 'elo', 'amex', 'hipercard', 'diners', 'discover', 'unifycard', 'other');
CREATE TYPE card_limit_type AS ENUM ('total', 'purchase', 'credit_line', 'temporary');
CREATE TYPE card_reissue_reason AS ENUM ('lost', 'stolen', 'damaged', 'name_change', 'fraud_suspected', 'technical_issue', 'upgrade', 'user_request', 'system_replacement');
CREATE TYPE commission_recipient_type AS ENUM ('user', 'regional_account', 'referral');
CREATE TYPE commission_target AS ENUM ('platform', 'region', 'external_partner', 'unify_bank');
CREATE TYPE commission_type AS ENUM ('percentage', 'fixed', 'tiered');
CREATE TYPE communication_channel AS ENUM ('in_app', 'email', 'sms', 'push', 'whatsapp', 'phone_call', 'chat', 'social_media', 'in_person', 'external_api');
CREATE TYPE currency AS ENUM ('brl', 'usd', 'unity_point', 'work_credit', 'barter_token');
CREATE TYPE custom_field_type AS ENUM ('text', 'textarea', 'number', 'date', 'datetime', 'boolean', 'select', 'multiselect', 'file', 'image', 'phone', 'email', 'cpf', 'cnpj', 'url', 'rating');
CREATE TYPE day_of_week AS ENUM ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');
CREATE TYPE day_period AS ENUM ('morning', 'afternoon', 'evening', 'night', 'full_day', 'custom');
CREATE TYPE delivery_method AS ENUM ('bike', 'car', 'van', 'on_foot');
CREATE TYPE discount_type AS ENUM ('percentage', 'fixed_amount', 'free_shipping', 'buy_one_get_one', 'custom');
CREATE TYPE document_type AS ENUM ('cpf', 'cnpj', 'rg', 'cnh', 'utility_bill', 'other', 'passport', 'contract', 'address_proof', 'birth_certificate', 'marriage_certificate', 'voter_id', 'custom');
CREATE TYPE event_category AS ENUM ('music', 'sports', 'theater', 'conference', 'workshop', 'other');
CREATE TYPE fee_code AS ENUM ('transaction_fee', 'service_fee', 'platform_fee', 'convenience_fee', 'admin_fee', 'processing_fee', 'base_fee', 'distance_fee', 'time_fee', 'night_fee', 'express_fee', 'fixed_rate', 'regional_contribution', 'standard_commission', 'dynamic_pricing', 'event_ticket_fee', 'product_sale_fee', 'manual_adjustment', 'custom');
CREATE TYPE financial_account_medium AS ENUM ('bank_account', 'unifybank', 'unifycard', 'external_card', 'pix_key', 'crypto_wallet');
CREATE TYPE gender_identity AS ENUM ('male', 'female', 'non_binary', 'trans_woman', 'trans_man', 'travesti', 'agender', 'genderfluid', 'other', 'prefer_not_to_say');
CREATE TYPE operation_context AS ENUM ('admin_action', 'admin_manual', 'api_request', 'balance_adjustment', 'blockage', 'campaign', 'cancellation', 'card', 'channel', 'chargeback', 'checkout', 'cleanliness', 'communication', 'complaint', 'content_review', 'custom_agreement', 'customer_service', 'dashboard', 'delivery', 'direct_payment', 'dispute', 'document_verification', 'event', 'event_organization', 'fidelity', 'login', 'manual_adjustment', 'marketplace', 'marketplace_order', 'method', 'module', 'notification_dispatch', 'order', 'order_checkout', 'order_shipping', 'other', 'overall_experience', 'payment_processing', 'penalty', 'pricing', 'product', 'product_quality', 'product_sale', 'professionalism', 'profile_update', 'punctuality', 'reason', 'refund_processing', 'rental', 'responsiveness', 'review', 'ride', 'ride_request', 'safety', 'search_event', 'search_general', 'search_product', 'search_region', 'search_service', 'search_tag', 'search_user', 'service', 'service_booking', 'service_page', 'service_quality', 'service_sale', 'shipping', 'status', 'subscription', 'support_ticket', 'system_event', 'ticket', 'time', 'transport', 'trustworthiness', 'unifybank_account', 'unifycard', 'user_action', 'user_auth', 'user_document', 'user_profile', 'user_request', 'verification');
CREATE TYPE privacy_event_type AS ENUM ('created', 'updated', 'deleted', 'viewed', 'downloaded', 'exported', 'consent_given', 'consent_withdrawn', 'shared', 'revoked', 'accessed', 'login', 'logout');
CREATE TYPE linked_entity_type AS ENUM ('user', 'user_profile', 'merchant_profile', 'provider_profile', 'ride_booking', 'service_booking', 'delivery_order', 'financial_transaction', 'unifycard', 'order', 'product', 'account', 'company', 'admin_profile', 'app', 'business', 'campaign', 'commission', 'dispute_case', 'document', 'event', 'media', 'notification', 'policy', 'project', 'promo_banner', 'region', 'rental', 'report', 'review', 'ride', 'service', 'subscription', 'support_ticket', 'system', 'ticket', 'unifybank_account', 'bundle', 'promotion');
CREATE TYPE carrier_type AS ENUM ('internal', 'external', 'partner');
CREATE TYPE login_method AS ENUM ('email_password', 'phone_code', 'magic_link', 'social_google', 'social_facebook', 'social_apple', 'social_gov_br', 'unifycard_login', 'biometric', 'admin_override');
CREATE TYPE loyalty_tier AS ENUM ('bronze', 'silver', 'gold', 'platinum', 'diamond', 'legend');
CREATE TYPE media_type AS ENUM ('image', 'video', 'audio', 'document', 'pdf', 'zip', 'spreadsheet', 'presentation', 'avatar', 'banner', 'logo', 'proof', 'other');
CREATE TYPE movement_type AS ENUM ('credit', 'debit', 'cashback', 'chargeback', 'fee', 'reversal', 'bonus', 'release', 'loyalty_claim', 'partner_rebate', 'community_contribution');
CREATE TYPE notification_type AS ENUM ('system_alert', 'order_update', 'ride_arrived', 'payment_success', 'payment_failure', 'support_reply', 'document_approved', 'document_rejected', 'profile_reviewed', 'balance_changed');
CREATE TYPE owner_type AS ENUM ('user', 'region', 'system', 'unifybank', 'user_profile', 'regional_account', 'campaign', 'unifycard', 'unifybank_account', 'company', 'individual', 'region_account', 'platform');
CREATE TYPE payment_method_type AS ENUM ('credit_card', 'debit_card', 'unifycard', 'pix', 'boleto', 'cash', 'bank_transfer', 'external_gateway', 'balance', 'manual_entry');
CREATE TYPE payment_period_type AS ENUM ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly');
CREATE TYPE payment_source_type AS ENUM ('unifycard', 'credit_card', 'debit_card', 'pix', 'boleto', 'cashback', 'affiliate_credit', 'partner_credit', 'regional_fund', 'manual_adjustment', 'external_gateway');
CREATE TYPE phone_type AS ENUM ('mobile', 'whatsapp', 'landline', 'commercial', 'residential', 'emergency', 'fax', 'other');
CREATE TYPE policy_type AS ENUM ('terms_of_use', 'privacy_policy', 'refund_policy', 'delivery_policy', 'community_guidelines', 'content_policy', 'financial_policy', 'governance_policy', 'promotion_policy', 'unifybank_policy', 'data_protection', 'code_of_conduct', 'other');
CREATE TYPE preferred_language AS ENUM ('pt_br', 'en_us', 'es', 'fr', 'de', 'it', 'ja', 'zh', 'other');
CREATE TYPE person_type AS ENUM ('PF', 'PJ');
CREATE TYPE priority AS ENUM ('low', 'medium', 'high', 'critical', 'urgent', 'immediate');
CREATE TYPE alert_level AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE profile_type AS ENUM ('individual', 'organization');
CREATE TYPE region_level AS ENUM ('neighborhood', 'local', 'municipal', 'district', 'city', 'state', 'national', 'country', 'global', 'custom');
CREATE TYPE rental_type AS ENUM ('vehicle', 'equipment', 'property', 'room', 'tool', 'furniture', 'event_space', 'clothing', 'electronics', 'custom');
CREATE TYPE review_rating AS ENUM ('very_bad', 'bad', 'neutral', 'good', 'very_good', 'excellent');
CREATE TYPE review_target_type AS ENUM ('product', 'order', 'service', 'ride', 'rental', 'event', 'ticket', 'user', 'user_profile', 'support_ticket', 'delivery', 'checkout', 'subscription', 'campaign', 'unifycard', 'unifybank_account', 'experience', 'other');
CREATE TYPE role_type AS ENUM ('user', 'business_owner', 'moderator', 'support_agent', 'reviewer', 'auditor', 'approver', 'campaign_manager', 'project_coordinator', 'investor', 'driver', 'seller', 'customer', 'guest', 'other');
CREATE TYPE lead_source AS ENUM ('organic', 'referral', 'paid_ads', 'partner', 'social_media', 'event');
CREATE TYPE service_type AS ENUM ('beauty', 'repair', 'transport', 'education', 'entertainment', 'consulting', 'delivery', 'maintenance', 'cleaning', 'health', 'legal', 'financial', 'installation', 'construction', 'it_support', 'events', 'pet_care', 'home_service', 'car_service', 'personal_trainer', 'childcare', 'custom');
CREATE TYPE service_unit AS ENUM ('per_hour', 'per_day', 'per_night', 'per_week', 'per_month', 'per_session', 'per_visit', 'per_km', 'per_delivery', 'per_item', 'per_person', 'fixed', 'custom');
CREATE TYPE shipping_method AS ENUM ('local_delivery', 'scheduled_delivery', 'express_delivery', 'pickup_on_site', 'partner_logistics', 'third_party_shipping', 'correios', 'motoboy', 'drone', 'locker', 'crowd_shipping', 'manual', 'other');
CREATE TYPE deal_stage AS ENUM ('lead', 'negotiation', 'proposal', 'won', 'lost', 'closed');
CREATE TYPE shipping_policy_code AS ENUM ('free_shipping', 'paid_shipping', 'conditional_free_shipping', 'pickup_only', 'local_only', 'national_only', 'custom_quote', 'partner_courier', 'platform_shipping', 'no_shipping_required', 'scheduled_only', 'manual_policy', 'other');
CREATE TYPE workflow_status AS ENUM ('success', 'error', 'pending', 'in_progress');
CREATE TYPE task_category AS ENUM ('cleaning', 'construction', 'delivery', 'installation', 'maintenance', 'repair', 'security', 'transport', 'support');
CREATE TYPE task_role AS ENUM ('bricklayer', 'electrician', 'plumber', 'cleaner', 'manicure', 'waiter', 'security', 'cook', 'driver', 'assistant', 'nanny', 'elderly_caregiver', 'housekeeper');
CREATE TYPE taxonomy AS ENUM ('product', 'service', 'event', 'campaign', 'category', 'tag', 'location', 'interest', 'module', 'entity', 'profile', 'content', 'document', 'media', 'notification', 'other');
CREATE TYPE ticket_type AS ENUM ('event_entry', 'transport_pass', 'queue_reservation', 'voucher', 'discount_coupon', 'access_pass', 'raffle_entry', 'membership', 'subscription', 'service_booking', 'product_pickup', 'donation_receipt', 'system_generated', 'custom');
CREATE TYPE transaction_status AS ENUM ('authorized', 'cancelled', 'expired', 'failed', 'paid', 'pending', 'processing', 'refunded');
CREATE TYPE transaction_trigger_type AS ENUM ('manual', 'automatic', 'external_api', 'user_action', 'system_event', 'other');
CREATE TYPE transaction_type AS ENUM ('payment', 'refund', 'withdrawal', 'deposit', 'transfer', 'commission', 'purchase', 'chargeback', 'fee', 'adjustment', 'bonus', 'refund_request', 'reward', 'penalty', 'subscription', 'payment_plan', 'system_credit','credit','debit', 'barter', 'social', 'manual_entry');
CREATE TYPE user_role AS ENUM ('buyer', 'seller', 'admin', 'driver', 'service_provider', 'host', 'delivery_person', 'partner_staff', 'business_owner', 'project_creator', 'campaign_participant', 'donor', 'volunteer', 'investor', 'guest', 'user', 'other');
CREATE TYPE validation_device_type AS ENUM ('mobile_app', 'admin_panel', 'partner_panel', 'qr_scanner', 'nfc_reader', 'pos_terminal', 'self_service_terminal', 'kiosk', 'web_portal', 'external_api', 'manual_entry', 'other');
CREATE TYPE validation_type AS ENUM ('identity_verification', 'document_check', 'address_verification', 'ticket_validation', 'qr_code_scan', 'nfc_validation', 'face_match', 'manual_review', 'automated_check', 'device_validation', 'access_control', 'payment_verification', 'check_in', 'check_out', 'signature_capture', 'age_verification', 'biometric_authentication', 'two_factor_authentication', 'system_validation', 'other');
CREATE TYPE user_workflow_action AS ENUM ('login', 'logout', 'register', 'reset_password', 'update_profile', 'change_email', 'change_password', 'delete_account', 'activate_account', 'deactivate_account', 'request_verification', 'approve_verification', 'deny_verification', 'link_social', 'unlink_social', 'enable_2fa', 'disable_2fa');
CREATE TYPE verification_permission_level AS ENUM ('basic_validation', 'full_validation', 'admin_validation', 'verification_officer');
CREATE TYPE verification_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled', 'expired', 'manual_verification_required', 'under_review', 'verified_by_agent', 'verified_by_system');
CREATE TYPE supplier_type AS ENUM ('manufacturer', 'distributor', 'importer', 'wholesaler', 'retailer', 'service_provider');
CREATE TYPE tax_regime AS ENUM ('simples_nacional', 'lucro_presumido', 'lucro_real', 'mei', 'outro');
CREATE TYPE social_group_type AS ENUM ('public', 'private', 'secret');
CREATE TYPE hobby_category AS ENUM ('movies_and_series', 'food_and_drinks', 'sports', 'music', 'reading', 'technology', 'events', 'travel', 'wellness', 'gastronomy', 'art', 'nerd_stuff', 'around_the_city');
CREATE TYPE company_type AS ENUM ('MEI', 'LTDA', 'EIRELI', 'SA');
CREATE TYPE company_size AS ENUM ('micro', 'pequena', 'media', 'grande');
CREATE TYPE company_sector AS ENUM ('industria', 'comercio', 'servicos', 'tecnologia', 'agropecuaria', 'educacao', 'saude', 'financeiro', 'governo', 'outro');

-- 🌎 ESTADOS
CREATE TABLE state (
  state_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL CHECK (char_length(name) > 0),
  uf CHAR(2) NOT NULL UNIQUE CHECK (uf ~ '^[A-Z]{2}$'),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
COMMENT ON TABLE state IS 'Tabela de estados com sigla (UF) e nome completo.';


-- 🏙️ CIDADES
CREATE TABLE city (
  city_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_id UUID NOT NULL REFERENCES state(state_id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL CHECK (char_length(name) > 0),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  CONSTRAINT unique_city_state UNIQUE (state_id, name)
);
CREATE UNIQUE INDEX idx_unique_city_state_lower ON city(state_id, LOWER(name));
COMMENT ON TABLE city IS 'Cidades associadas a um estado. Nome único por estado.';


-- 🏘️ BAIRROS
CREATE TABLE neighborhood (
  neighborhood_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID NOT NULL REFERENCES city(city_id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL CHECK (char_length(name) > 0),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  CONSTRAINT unique_neighborhood_city UNIQUE (city_id, name)
);
CREATE UNIQUE INDEX idx_unique_neighborhood_city_lower ON neighborhood(city_id, LOWER(name));
COMMENT ON TABLE neighborhood IS 'Bairros únicos por cidade, com índice insensível a maiúsculas.';


-- 🧭 FAIXA DE CEP ASSOCIADA A BAIRROS
CREATE TABLE address_cep_range (
  cep_start CHAR(8) NOT NULL CHECK (cep_start ~ '^\d{8}$'),
  cep_end   CHAR(8) NOT NULL CHECK (cep_end ~ '^\d{8}$'),
  neighborhood_id UUID NOT NULL REFERENCES neighborhood(neighborhood_id) ON DELETE CASCADE,
  PRIMARY KEY (cep_start, cep_end, neighborhood_id),
  CONSTRAINT chk_cep_range_valid CHECK (cep_start <= cep_end)
);
COMMENT ON TABLE address_cep_range IS 'Faixas de CEP vinculadas a bairros para determinar a localização do usuário.';

-- 👤 USUÁRIO BASE
CREATE TABLE "user" (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  email VARCHAR(255) NOT NULL UNIQUE CHECK (char_length(email) > 0),
  password_hash TEXT NOT NULL,

  is_email_verified BOOLEAN DEFAULT FALSE,
  is_phone_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  phone VARCHAR(20),

  generated_referral_code VARCHAR(12) NOT NULL UNIQUE,
  consent_at TIMESTAMP,

  last_login_at TIMESTAMP,
  login_attempts SMALLINT DEFAULT 0 CHECK (login_attempts >= 0),

  created_at TIMESTAMP DEFAULT now() NOT NULL,
  updated_at TIMESTAMP DEFAULT now(),
  deleted_at TIMESTAMP
);

COMMENT ON TABLE "user" IS 'Usuários da plataforma com dados de login e status.';
COMMENT ON COLUMN "user".generated_referral_code IS 'Código único gerado automaticamente para indicar outros usuários.';

-- Índices
CREATE UNIQUE INDEX idx_user_email ON "user"(LOWER(email));
CREATE INDEX idx_user_status ON "user"(is_active, is_email_verified);


-- 💰 CONTA REGIONAL POR BAIRRO
CREATE TABLE regional_account (
  regional_account_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  neighborhood_id UUID NOT NULL UNIQUE REFERENCES neighborhood(neighborhood_id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT now() NOT NULL
);
COMMENT ON TABLE regional_account IS 'Conta coletiva vinculada a um bairro.';

CREATE TABLE regional_account_balance (
  regional_account_id UUID PRIMARY KEY REFERENCES regional_account(regional_account_id) ON DELETE CASCADE,
  balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  last_updated TIMESTAMP DEFAULT now() NOT NULL
);
COMMENT ON TABLE regional_account_balance IS 'Saldo da conta regional.';

CREATE TABLE regional_account_transaction (
  transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regional_account_id UUID NOT NULL REFERENCES regional_account(regional_account_id) ON DELETE CASCADE,
  user_id UUID REFERENCES "user"(user_id),
  amount NUMERIC(18,2) NOT NULL,
  type transaction_type NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT now() NOT NULL
);
CREATE INDEX idx_transaction_regional_account ON regional_account_transaction(regional_account_id, created_at DESC);

CREATE TABLE user_profile (
  user_profile_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relacionamentos obrigatórios
  regional_account_id UUID NOT NULL REFERENCES regional_account(regional_account_id) ON DELETE CASCADE,
  user_id UUID NOT NULL UNIQUE REFERENCES "user"(user_id) ON DELETE CASCADE,

  -- Identificação e nome completo
  first_name VARCHAR(100) NOT NULL CHECK (char_length(first_name) > 0),
  last_name  VARCHAR(100) NOT NULL CHECK (char_length(last_name) > 0),
  name TEXT GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,

  -- Documentação e nascimento
  cpf BYTEA NOT NULL,
  birth_date DATE,

  -- Contato e sexo/gênero
  phone VARCHAR(20),
  biological_sex biological_sex,
  gender_identity gender_identity,
  marital_status TEXT,

  -- Características físicas
  height_cm INTEGER CHECK (height_cm >= 30 AND height_cm <= 300),
  weight_kg INTEGER CHECK (weight_kg >= 1 AND weight_kg <= 500),

  -- Filhos
  has_children BOOLEAN,
  children_count INTEGER CHECK (children_count >= 0),
  children_ages JSONB DEFAULT '[]',

  -- Endereço
  neighborhood_id UUID REFERENCES neighborhood(neighborhood_id) ON DELETE SET NULL,
  city_id UUID REFERENCES city(city_id) ON DELETE SET NULL,
  state_id UUID REFERENCES state(state_id) ON DELETE SET NULL,
  cep CHAR(8) CHECK (cep ~ '^\d{8}$'),
  street TEXT,
  number TEXT,
  complement TEXT,

  -- Preferências
  preferences TEXT,

  -- Educação e carreira
  education_level TEXT,
  academic_degrees JSONB DEFAULT '[]',
  completed_courses JSONB DEFAULT '[]',
  certifications JSONB DEFAULT '[]',
  occupation TEXT,
  employment_type TEXT,
  monthly_income_range TEXT,

  -- Situação residencial e familiar
  housing_situation TEXT,
  residents INTEGER CHECK (residents >= 0),
  dependents_count INTEGER CHECK (dependents_count >= 0),

  -- Acessibilidade e benefícios
  receives_social_benefit BOOLEAN,
  social_benefit_details TEXT,
  has_disability BOOLEAN,
  disability_details TEXT,
  need_accessibility BOOLEAN,

  -- Outras características
  languages_spoken JSONB DEFAULT '[]',
  has_transport TEXT,
  is_caregiver BOOLEAN,
  has_animals BOOLEAN,
  available_periods JSONB DEFAULT '[]',

  -- Status e relacionamento com o sistema
  profile_status generic_status DEFAULT 'active',
  referral_code TEXT UNIQUE NOT NULL CHECK (char_length(referral_code) > 0),
  referrer_profile_id UUID REFERENCES user_profile(user_profile_id),

  -- Auditoria
  created_at TIMESTAMP DEFAULT now() NOT NULL,
  updated_at TIMESTAMP DEFAULT now(),
  deleted_at TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profile_cpf ON user_profile((encode(cpf, 'hex')));
CREATE INDEX IF NOT EXISTS idx_user_profile_city ON user_profile(city_id);
CREATE INDEX IF NOT EXISTS idx_user_profile_state ON user_profile(state_id);
CREATE INDEX IF NOT EXISTS idx_user_profile_regional ON user_profile(regional_account_id);
CREATE INDEX IF NOT EXISTS idx_user_profile_referrer ON user_profile(referrer_profile_id);
CREATE INDEX IF NOT EXISTS idx_user_profile_status ON user_profile(profile_status);

-- 👥 GRUPOS SOCIAIS
CREATE TABLE social_group (
  group_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL CHECK (char_length(name) > 0),
  description TEXT,
  created_at TIMESTAMP DEFAULT now() NOT NULL
);
COMMENT ON TABLE social_group IS 'Grupos sociais criados para engajamento de usuários.';

-- 🔐 Índice opcional se quiser evitar nomes duplicados de grupo
-- CREATE UNIQUE INDEX idx_social_group_name ON social_group(LOWER(name));

-- 👤 ASSOCIAÇÃO DE USUÁRIO AO GRUPO SOCIAL
CREATE TABLE user_social_group (
  user_profile_id UUID REFERENCES user_profile(user_profile_id) ON DELETE CASCADE,
  group_id UUID REFERENCES social_group(group_id) ON DELETE CASCADE,
  joined_at TIMESTAMP DEFAULT now() NOT NULL,
  PRIMARY KEY (user_profile_id, group_id)
);
COMMENT ON TABLE user_social_group IS 'Associação entre perfis de usuário e grupos sociais.';


-- 🌎 INSERÇÃO DE ESTADO BASE (Paraná)
INSERT INTO state (name, uf)
VALUES ('Paraná', 'PR')
ON CONFLICT (uf) DO NOTHING;

-- 🏙️ INSERÇÃO DE CIDADE BASE (Curitiba)
INSERT INTO city (state_id, name)
VALUES (
  (SELECT state_id FROM state WHERE uf = 'PR'),
  'Curitiba'
)
ON CONFLICT (state_id, name) DO NOTHING;


-- 🏘️ INSERÇÃO DE BAIRROS DE CURITIBA
DO $$
DECLARE
  curitiba_city_id UUID;
  bairro TEXT;
  bairros TEXT[] := ARRAY[
    'Abranches','Água Verde','Ahú','Alto Boqueirão','Alto da Glória','Alto da XV','Atuba','Augusta','Bacacheri',
    'Bairro Alto','Bairro Novo','Barreirinha','Batel','Bigorrilho','Boa Vista','Bom Retiro','Boqueirão','Butiatuvinha',
    'Cabral','Cachoeira','Cajuru','Campina do Siqueira','Campo Comprido','Campo de Santana','Capão da Imbuia','Capão Raso',
    'Cascatinha','Caximba','Centro','Centro Cívico','Cidade Industrial','Cristo Rei','Fanny','Fazendinha','Ganchinho',
    'Guabirotuba','Guaíra','Hauer','Hugo Lange','Jardim Botânico','Jardim Social','Jd. das Américas','Juvevê','Lamenha Pequena',
    'Lindoia','Mercês','Mossunguê','Novo Mundo','Orleans','Parolin','Pilarzinho','Pinheirinho','Portão',
    'Prado Velho','Rebouças','Riviera','Santa Cândida','Santa Felicidade','Santa Quitéria','Santo Inácio','São Braz',
    'São Francisco','São João','São Lourenço','São Miguel','Seminário','Sitio Cercado','Taboão','Tarumã','Tatuquara',
    'Tingui','Uberaba','Umbará','Vila Izabel','Vista Alegre','Xaxim'
  ];
BEGIN
  SELECT city_id INTO curitiba_city_id
  FROM city
  WHERE name = 'Curitiba'
    AND state_id = (SELECT state_id FROM state WHERE uf = 'PR');

  FOREACH bairro IN ARRAY bairros LOOP
    INSERT INTO neighborhood (city_id, name)
    VALUES (curitiba_city_id, bairro)
    ON CONFLICT (city_id, name) DO NOTHING;
  END LOOP;
END $$;

-- 💼 INSERÇÃO DE CONTAS REGIONAIS PARA CADA BAIRRO DE CURITIBA
INSERT INTO regional_account (neighborhood_id)
SELECT n.neighborhood_id
FROM neighborhood n
LEFT JOIN regional_account ra ON ra.neighborhood_id = n.neighborhood_id
WHERE n.city_id = (
  SELECT city_id FROM city
  WHERE name = 'Curitiba'
)
AND ra.regional_account_id IS NULL;

-- 🧾 INSERÇÃO DE FAIXAS DE CEP SIMULADAS (para testes iniciais ou produção)
DO $$
DECLARE
  rec RECORD;
  i INT := 0;
BEGIN
  FOR rec IN
    SELECT neighborhood_id
    FROM neighborhood
    WHERE city_id = (
      SELECT city_id FROM city
      WHERE name = 'Curitiba'
    )
  LOOP
    -- 🏷️ Gera uma faixa de 1000 CEPs por bairro, começando em 80000000
    INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
    VALUES (
      LPAD((80000000 + i * 1000)::text, 8, '0'),
      LPAD((80000999 + i * 1000)::text, 8, '0'),
      rec.neighborhood_id
    )
    ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

    i := i + 1;
  END LOOP;
END $$;

  -- Abranches
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '82130010',
    '82220670',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Abranches' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Água Verde
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '80220202',
    '80630200',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Água Verde' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Ahú
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '80030285',
    '82200530',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Ahú' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Alto Boqueirão
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '81720230',
    '81860400',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Alto Boqueirão' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Alto da Glória
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '80030000',
    '80530233',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Alto da Glória' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Alto da Rua XV
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '80045000',
    '80050981',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Alto da XV' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Atuba
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '82590100',
    '82860580',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Atuba' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Augusta
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '81265000',
    '81265490',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Augusta' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Bacacheri
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '82501970',
    '82600750',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Bacacheri' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Bairro Alto
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '82590200',
    '82840540',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Bairro Alto' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Barreirinha
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '82220000',
    '82710140',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Barreirinha' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Batel
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '80240000',
    '80730420',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Batel' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Bigorrilho
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '80430000',
    '82010715',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Bigorrilho' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Boa Vista
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '82200540',
    '82650320',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Boa Vista' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Bom Retiro
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '80520080',
    '80520620',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Bom Retiro' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Boqueirão
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '81617970',
    '81770615',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Boqueirão' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Butiatuvinha
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '82315430',
    '82400612',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Butiatuvinha' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Cabral
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '80035000',
    '82200700',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Cabral' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Cachoeira
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '82220350',
    '82710520',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Cachoeira' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Cajuru
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '82900000',
    '82990530',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Cajuru' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Campina do Siqueira
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '80440020',
    '80740700',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Campina do Siqueira' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Campo Comprido
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '81200240',
    '81280270',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Campo Comprido' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Campo de Santana
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '81490000',
    '81945050',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Campo de Santana' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Capão da Imbuia
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '82800210',
    '82810780',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Capão da Imbuia' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Capão Raso
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '81020590',
    '81170970',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Capão Raso' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Cascatinha
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '82015080',
    '82025280',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Cascatinha' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Caximba
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '81495000',
    '81495030',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Caximba' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Centro
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '80010000',
    '80430280',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Centro' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Centro Cívico
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '80030020',
    '80540310',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Centro Cívico' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Cidade Industrial
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '81010970',
    '82305200',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Cidade Industrial' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Cristo Rei
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '80050150',
    '82530195',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Cristo Rei' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Fanny
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '81030000',
    '81030970',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Fanny' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Fazendinha
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '81070460',
    '81330680',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Fazendinha' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Ganchinho
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '81935370',
    '81935720',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Ganchinho' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Guabirotuba
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '81510000',
    '81690170',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Guabirotuba' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Guaíra
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '80220310',
    '81010300',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Guaíra' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Hauer
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '81610000',
    '81630900',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Hauer' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Hauer
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '81610000',
    '81630900',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Hauer' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Hugo Lange
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '80040150',
    '80040460',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Hugo Lange' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Jardim Botânico
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '80060070',
    '81690100',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Jardim Botânico' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Jardim das Américas
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '81520010',
    '81690190',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Jd. das Américas' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Jardim Social
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '82520000',
    '82530190',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Jardim Social' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Juvevê
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '80030001',
    '80540010',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Juvevê' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Lamenha Pequena
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '82415010',
    '82415130',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Lamenha Pequena' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Lindóia
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '81010000',
    '81010280',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Lindoia' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Mercês
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '80410000',
    '80810900',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Mercês' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Mossunguê
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '81200000',
    '82305100',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Mossunguê' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Novo Mundo
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '81010320',
    '81110040',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Novo Mundo' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Orleans
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '81200380',
    '82310440',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Orleans' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Parolin
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '80220001',
    '81030090',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Parolin' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Pilarzinho
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '80520630',
    '82120620',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Pilarzinho' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Pinheirinho
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '81110520',
    '81880460',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Pinheirinho' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Portão
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '80310981',
    '81320380',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Portão' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Prado Velho
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '80215180',
    '81690150',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Prado Velho' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Rebouças
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '80002900',
    '80250200',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Rebouças' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Riviera
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '81295000',
    '81295000',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Riviera' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Santa Cândida
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '82620350',
    '82720560',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Santa Cândida' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Santa Felicidade
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '82010505',
    '82410680',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Santa Felicidade' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Santa Quitéria
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '80310000',
    '80330195',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Santa Quitéria' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Santo Inácio
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '82010000',
    '82300290',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Santo Inácio' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- São Braz
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '82015240',
    '82320970',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'São Braz' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- São Francisco
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '80020150',
    '80530090',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'São Francisco' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- São João
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '82030020',
    '82030680',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'São João' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- São Lourenço
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '82130970',
    '82210370',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'São Lourenço' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- São Miguel
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '81452010',
    '81452559',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'São Miguel' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Seminário
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '80240001',
    '80740580',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Seminário' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

 -- Sitio Cercado
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '81900000',
    '81935325',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Sitio Cercado' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Taboão
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '82130480',
    '82130705',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Taboão' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Tarumã
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '82530200',
    '82821030',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Tarumã' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Tatuquara
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '81470000',
    '81940200',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Tatuquara' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Tingui
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '82600000',
    '82620340',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Tingui' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Uberaba
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '81530510',
    '81590650',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Uberaba' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Umbará
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '81930000',
    '81940506',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Umbará' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Vila Izabel
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '80240041',
    '80620010',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Vila Izabel' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Vista Alegre
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '80810160',
    '82100160',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Vista Alegre' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

  -- Xaxim
  INSERT INTO address_cep_range (cep_start, cep_end, neighborhood_id)
  VALUES (
    '81630500',
    '81830740',
    (SELECT neighborhood_id FROM neighborhood 
     WHERE name = 'Xaxim' 
       AND city_id = (SELECT city_id FROM city WHERE name = 'Curitiba'))
  )
  ON CONFLICT (cep_start, cep_end, neighborhood_id) DO NOTHING;

-- 🏦 Conta bancária Unify vinculada ao usuário e à conta regional
CREATE TABLE unify_bank_account (
  unify_bank_account_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES "user"(user_id) ON DELETE CASCADE,
  regional_account_id UUID NOT NULL REFERENCES regional_account(regional_account_id) ON DELETE CASCADE,
  balance NUMERIC(12,2) DEFAULT 0 NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- 💳 Cartão Unify vinculado ao usuário
CREATE TABLE card (
  card_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES "user"(user_id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active', -- 🔒 Sugestão futura: ENUM card_status
  created_at TIMESTAMP DEFAULT now() NOT NULL
);

-- 💼 Regras de comissão
CREATE TABLE commission_rule (
  rule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('fidelidade', 'pix', 'venda')),
  group_name TEXT NOT NULL,
  commission_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  regional_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  platform_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ✅ Setores profissionais
CREATE TABLE profession_sector (
  code TEXT PRIMARY KEY,
  label_pt TEXT NOT NULL,
  label_en TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

INSERT INTO profession_sector (code, label_pt, label_en, is_active) VALUES
  ('alimentacao-e-bebidas', 'Alimentação e Bebidas', 'Food and Drinks', TRUE),
  ('construcao-e-reformas', 'Construção e Reformas', 'Construction and Renovation', TRUE),
  ('beleza', 'Beleza e Estética', 'Beauty and Wellness', TRUE),
  ('eventos', 'Eventos', 'Events', TRUE),
  ('saude', 'Saúde', 'Healthcare', TRUE),
  ('educacao', 'Educação', 'Education', TRUE),
  ('tecnologia', 'Tecnologia', 'Technology', TRUE),
  ('administrativo-e-financeiro', 'Administrativo e Financeiro', 'Finance and Administration', TRUE),
  ('domestico', 'Doméstico', 'Domestic', TRUE),
  ('servicos-em-geral', 'Serviços em Geral', 'General Services', TRUE),
  ('logistica', 'Logística e Transporte', 'Logistics and Transportation', TRUE)
ON CONFLICT (code) DO NOTHING;

-- ✅ Áreas profissionais
CREATE TABLE profession_area (
  area_code TEXT PRIMARY KEY,
  label_pt TEXT NOT NULL,
  label_en TEXT NOT NULL,
  sector_code TEXT NOT NULL REFERENCES profession_sector(code) ON DELETE CASCADE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_profession_area_sector ON profession_area(sector_code);

INSERT INTO profession_area (area_code, label_pt, label_en, sector_code, description) VALUES
  ('cozinha', 'Cozinha / Preparação', 'Kitchen / Preparation', 'alimentacao-e-bebidas', 'Preparo geral de alimentos.'),
  ('confeitaria', 'Confeitaria', 'Confectionery', 'alimentacao-e-bebidas', 'Doces, sobremesas e confeitaria fina.'),
  ('panificacao', 'Panificação', 'Bakery', 'alimentacao-e-bebidas', 'Pães, massas e assados.'),
  ('atendimento', 'Atendimento ao Cliente', 'Customer Service', 'alimentacao-e-bebidas', 'Serviço direto ao cliente.'),
  ('caixa', 'Operador de Caixa', 'Cashier', 'alimentacao-e-bebidas', 'Registro de vendas e pagamentos.'),
  ('delivery', 'Entregas / Delivery', 'Delivery', 'alimentacao-e-bebidas', 'Entrega de refeições e produtos.'),
  ('bar', 'Bar / Bebidas', 'Bar / Drinks', 'alimentacao-e-bebidas', 'Preparo de bebidas, drinks e cafés.'),
  ('churrasco', 'Churrasco / Espetinhos', 'Barbecue / Skewers', 'alimentacao-e-bebidas', 'Carnes grelhadas e espetos.'),
  ('buffet', 'Buffet e Eventos', 'Buffet / Events', 'alimentacao-e-bebidas', 'Montagem e serviço de eventos.')
ON CONFLICT (area_code) DO NOTHING;

-- ✅ Funções profissionais
CREATE TABLE profession_function (
  function_code TEXT PRIMARY KEY,
  label_pt TEXT NOT NULL,
  label_en TEXT NOT NULL,
  area_code TEXT NOT NULL REFERENCES profession_area(area_code) ON DELETE CASCADE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- 📈 Índice para acelerar buscas por área
CREATE INDEX idx_profession_function_area ON profession_function(area_code);

INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  -- Cozinha
  ('chapeiro', 'Chapeiro / Lancheiro', 'Grill Cook / Sandwich Maker', 'cozinha', 'Preparo de lanches, grelhados e chapas.'),
  ('cozinheiro', 'Cozinheiro(a)', 'Cook', 'cozinha', 'Preparação geral de pratos.'),
  ('auxiliar_cozinha', 'Auxiliar de Cozinha', 'Kitchen Assistant', 'cozinha', 'Apoio no preparo de alimentos e limpeza.'),
  ('chef_cozinha', 'Chef de Cozinha', 'Head Chef', 'cozinha', 'Responsável pela liderança e preparo geral.'),
  ('cozinheiro_industrial', 'Cozinheiro Industrial', 'Industrial Cook', 'cozinha', 'Preparação de refeições em larga escala.'),
  ('auxiliar_preparo', 'Auxiliar de Preparo', 'Prep Cook', 'cozinha', 'Pré-preparo de ingredientes e mise en place.'),
  ('pizzaiolo', 'Pizzaiolo(a)', 'Pizza Maker', 'cozinha', 'Preparo e assamento de pizzas.'),
  ('sushiman', 'Sushiman / Sushiwoman', 'Sushi Chef', 'cozinha', 'Especialista em preparo de sushis e pratos frios.'),
  ('itamae', 'Itamae (Mestre Japonês)', 'Itamae (Japanese Master Chef)', 'cozinha', 'Chef tradicional da culinária japonesa.'),
  ('assistente_sushi', 'Assistente de Sushi', 'Sushi Assistant', 'cozinha', 'Auxilia na preparação de pratos japoneses.'),
  ('higienizador_alimentos', 'Higienizador de Alimentos', 'Food Sanitizer', 'cozinha', 'Lava e higieniza alimentos e utensílios.'),
  ('limpeza_cozinha', 'Auxiliar de Limpeza de Cozinha', 'Kitchen Cleaner', 'cozinha', 'Limpeza de utensílios, bancadas e área de preparo.'),
  ('lavador_louca', 'Lavador de Louça', 'Dishwasher', 'cozinha', 'Responsável por lavar pratos, talheres e utensílios.'),
  ('cozinheiro_caseiro', 'Cozinheiro de Comida Caseira', 'Homestyle Cook', 'cozinha', 'Prepara comida tradicional brasileira.'),
  ('especialista_massas', 'Especialista em Massas', 'Pasta Specialist', 'cozinha', 'Preparo de massas frescas e recheadas.'),
  ('chef_de_cuisine', 'Chef de Cuisine / Cozinheiro Executivo', 'Chef de Cuisine', 'cozinha', 'Responsável por todo o funcionamento da cozinha e menu.'),
  ('sous_chef', 'Sous-Chef', 'Sous-Chef', 'cozinha', 'Assistente direto do chef, gerencia equipe e operações.'),
  ('chef_de_partie', 'Chef de Partie / Cozinheiro de Estação', 'Chef de Partie', 'cozinha', 'Responsável por uma linha ou estação específica.')
ON CONFLICT (function_code) DO NOTHING;

-- Confeitaria
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('confeiteiro', 'Confeiteiro(a)', 'Confectioner', 'confeitaria', 'Preparação de doces e sobremesas.'),
  ('doceiro', 'Doceiro(a)', 'Sweet Maker', 'confeitaria', 'Preparo de doces variados e sobremesas tradicionais.'),
  ('cake_designer', 'Decorador de Bolos / Cake Designer', 'Cake Designer', 'confeitaria', 'Decoração de bolos e confeitaria fina.'),
  ('brigadeiro_gourmet', 'Especialista em Brigadeiro Gourmet', 'Brigadeiro Specialist', 'confeitaria', 'Produção especializada de brigadeiros.')
ON CONFLICT (function_code) DO NOTHING;

-- Panificação
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('padeiro', 'Padeiro(a)', 'Baker', 'panificacao', 'Fabricação de pães, massas e fornadas.'),
  ('padeiro_artesanal', 'Padeiro Artesanal', 'Artisan Baker', 'panificacao', 'Produção manual de pães especiais.'),
  ('forneiro', 'Forneiro / Operador de Forno', 'Oven Operator', 'panificacao', 'Responsável pelos fornos e assamento.'),
  ('salgadeiro', 'Salgadeiro(a)', 'Savory Snack Maker', 'panificacao', 'Preparo de salgados como coxinha, pastel, empada.')
ON CONFLICT (function_code) DO NOTHING;

-- Atendimento
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('garcom', 'Garçom / Garçonete', 'Waiter / Waitress', 'atendimento', 'Atendimento de mesas, recepção de clientes.'),
  ('hotdog_vendedor', 'Vendedor de Hot Dog', 'Hot Dog Vendor', 'atendimento', 'Prepara, vende e serve hot dogs e lanches populares.')
ON CONFLICT (function_code) DO NOTHING;

-- Caixa
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('caixa', 'Operador de Caixa', 'Cashier', 'caixa', 'Responsável por registrar vendas e pagamentos.')
ON CONFLICT (function_code) DO NOTHING;

-- Delivery
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('entregador_comida', 'Entregador de Comida', 'Food Delivery Person', 'delivery', 'Entrega de refeições e alimentos preparados.')
ON CONFLICT (function_code) DO NOTHING;

-- Bar
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('barman', 'Barman / Bartender', 'Bartender', 'bar', 'Preparo de bebidas e drinks.'),
  ('barista', 'Barista / Café Especial', 'Barista', 'bar', 'Preparo de cafés especiais e bebidas quentes.')
ON CONFLICT (function_code) DO NOTHING;

-- Churrasco
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('churrasqueiro', 'Churrasqueiro(a)', 'Barbecue Cook', 'churrasco', 'Responsável pelo preparo e assado das carnes.'),
  ('auxiliar_churrasco', 'Auxiliar de Churrasco', 'Barbecue Assistant', 'churrasco', 'Apoio na preparação, corte e reposição.'),
  ('montador_espeto', 'Montador de Espetinhos', 'Skewer Assembler', 'churrasco', 'Montagem de espetinhos e porcionamento.'),
  ('costela_fogo_chao', 'Especialista em Costela Fogo de Chão', 'Pitmaster / Fire Pit Specialist', 'churrasco', 'Preparação artística de costelas no fogo de chão.'),
  ('pitmaster', 'Pitmaster (Defumação / Churrasco Americano)', 'Pitmaster', 'churrasco', 'Especialista em defumação e churrasco lento.')
ON CONFLICT (function_code) DO NOTHING;

-- Buffet e Eventos
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('garcom_evento', 'Garçom para eventos', 'Event Waiter', 'buffet', 'Atendimento de convidados em eventos.'),
  ('coordenador_buffet', 'Coordenador de Buffet', 'Buffet Coordinator', 'buffet', 'Coordenação de equipes e logística de buffet.'),
  ('montador_mesa', 'Montador de mesa / buffet', 'Buffet Table Assembler', 'buffet', 'Montagem e organização de mesas para buffet.'),
  ('auxiliar_buffet', 'Auxiliar de Buffet', 'Buffet Assistant', 'buffet', 'Apoio no preparo, reposição e limpeza.'),
  ('cerimonialista', 'Cerimonialista de Eventos', 'Event Planner / MC', 'buffet', 'Organização e condução de cerimônias e eventos.')
ON CONFLICT (function_code) DO NOTHING;

-- 🌟 ÁREAS DO SETOR DE BELEZA
INSERT INTO profession_area (area_code, label_pt, label_en, sector_code, description) VALUES
  ('cabelo', 'Cabelo', 'Hair', 'beleza', 'Serviços capilares e penteados.'),
  ('barba', 'Barba', 'Beard', 'beleza', 'Corte, desenho e cuidados com barba.'),
  ('unhas', 'Unhas', 'Nails', 'beleza', 'Cuidados estéticos com unhas das mãos e pés.'),
  ('maquiagem', 'Maquiagem', 'Makeup', 'beleza', 'Maquiagem para eventos, artística e social.'),
  ('depilacao', 'Depilação', 'Hair Removal', 'beleza', 'Serviços de remoção de pelos.'),
  ('estetica_corporal', 'Estética Corporal', 'Body Aesthetics', 'beleza', 'Massagens e tratamentos corporais.'),
  ('estetica_facial', 'Estética Facial', 'Facial Aesthetics', 'beleza', 'Tratamentos faciais e rejuvenescimento.'),
  ('sobrancelhas', 'Sobrancelhas e Cílios', 'Brows and Lashes', 'beleza', 'Design, tintura e alongamento.'),
  ('micropigmentacao', 'Micropigmentação', 'Micropigmentation', 'beleza', 'Técnicas de pigmentação estética.'),
  ('bronzeamento', 'Bronzeamento', 'Tanning', 'beleza', 'Bronzeamento natural e artificial.'),
  ('spa_relaxamento', 'Spa e Relaxamento', 'Spa and Relaxation', 'beleza', 'Terapias de bem-estar e relaxamento.'),
  ('biomedicina_estetica', 'Biomedicina Estética', 'Aesthetic Biomedicine', 'beleza', 'Procedimentos estéticos avançados.'),
  ('eventos_beleza', 'Beleza para Eventos', 'Event Beauty Services', 'beleza', 'Serviços de beleza voltados para eventos.')
ON CONFLICT (area_code) DO NOTHING;

-- 💇 FUNÇÕES DO SETOR DE BELEZA

-- Cabelo
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('cabeleireiro', 'Cabeleireiro(a)', 'Hairdresser', 'cabelo', 'Cortes, coloração e tratamentos capilares.'),
  ('escovista', 'Escovista', 'Blow-Dry Specialist', 'cabelo', 'Especialista em escovas e modelagens.'),
  ('trancista', 'Trancista', 'Hair Braider', 'cabelo', 'Tranças afro, nagô, box braids e similares.'),
  ('colorista', 'Colorista Capilar', 'Hair Colorist', 'cabelo', 'Especialista em tintura e descoloração.'),
  ('penteadista', 'Penteadista para Eventos', 'Event Hair Stylist', 'cabelo', 'Penteados para festas e casamentos.')
ON CONFLICT (function_code) DO NOTHING;

-- Barba
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('barbeiro', 'Barbeiro(a)', 'Barber', 'barba', 'Corte, desenho e cuidados com barba e cabelo.'),
  ('desenhador_barba', 'Desenhador de Barba', 'Beard Designer', 'barba', 'Criação de desenhos e estilos na barba.')
ON CONFLICT (function_code) DO NOTHING;

-- Unhas
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('manicure', 'Manicure', 'Manicurist', 'unhas', 'Cuidados com unhas das mãos.'),
  ('pedicure', 'Pedicure', 'Pedicurist', 'unhas', 'Cuidados com unhas dos pés.'),
  ('nail_designer', 'Designer de Unhas', 'Nail Designer', 'unhas', 'Alongamento, esmaltação em gel e nail art.')
ON CONFLICT (function_code) DO NOTHING;

-- Maquiagem
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('maquiador', 'Maquiador(a)', 'Makeup Artist', 'maquiagem', 'Maquiagem social, festa, artística e HD.'),
  ('maquiagem_noiva', 'Maquiagem para Noiva', 'Bridal Makeup Artist', 'maquiagem', 'Especialista em maquiagem para noivas.')
ON CONFLICT (function_code) DO NOTHING;

-- Estética Corporal
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('massoterapeuta', 'Massoterapeuta', 'Massage Therapist', 'estetica_corporal', 'Massagens terapêuticas e estéticas.'),
  ('drenagem_linfatica', 'Drenagem Linfática', 'Lymphatic Drainage Specialist', 'estetica_corporal', 'Técnica de massagem para eliminação de líquidos.'),
  ('modeladora', 'Massagem Modeladora', 'Body Shaping Massage', 'estetica_corporal', 'Redução de medidas e modelagem corporal.')
ON CONFLICT (function_code) DO NOTHING;

-- Estética Facial
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('limpeza_pele', 'Limpeza de Pele', 'Facial Cleansing', 'estetica_facial', 'Higienização profunda da pele.'),
  ('peeling', 'Peeling Estético', 'Aesthetic Peeling', 'estetica_facial', 'Esfoliação para renovação celular.')
ON CONFLICT (function_code) DO NOTHING;

-- Sobrancelhas e Cílios
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('designer_sobrancelhas', 'Designer de Sobrancelhas', 'Eyebrow Designer', 'sobrancelhas', 'Modelagem, design e tintura.'),
  ('lash_designer', 'Designer de Cílios', 'Lash Designer', 'sobrancelhas', 'Alongamento, curvatura e volume dos cílios.')
ON CONFLICT (function_code) DO NOTHING;

-- Micropigmentação
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('micropigmentador', 'Micropigmentador(a)', 'Micropigmentation Specialist', 'micropigmentacao', 'Pigmentação estética em sobrancelhas, lábios ou olhos.')
ON CONFLICT (function_code) DO NOTHING;

-- Bronzeamento
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('bronze_artificial', 'Especialista em Bronzeamento Artificial', 'Tanning Specialist', 'bronzeamento', 'Aplicação de autobronzeadores e cabine.'),
  ('bronze_fita', 'Bronzeamento com Fita', 'Tape Tanning Specialist', 'bronzeamento', 'Técnica de bronzeamento com marcação artística.')
ON CONFLICT (function_code) DO NOTHING;

-- Spa e Relaxamento
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('terapeuta_spa', 'Terapeuta de Spa', 'Spa Therapist', 'spa_relaxamento', 'Tratamentos relaxantes e terapias sensoriais.')
ON CONFLICT (function_code) DO NOTHING;

-- Biomedicina Estética
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('biomedico_estetico', 'Biomédico Esteta', 'Aesthetic Biomedical Professional', 'biomedicina_estetica', 'Aplicações estéticas avançadas com formação técnica.'),
  ('aplicador_botox', 'Aplicador de Botox', 'Botox Applicator', 'biomedicina_estetica', 'Aplicação de toxina botulínica.'),
  ('especialista_skinbooster', 'Especialista em Skinbooster', 'Skinbooster Specialist', 'biomedicina_estetica', 'Hidratação profunda com ativos injetáveis.'),
  ('intradermoterapia_estetica', 'Aplicador de Intradermoterapia', 'Aesthetic Mesotherapy Specialist', 'biomedicina_estetica', 'Aplicações localizadas de ativos.')
ON CONFLICT (function_code) DO NOTHING;

-- Eventos e Casamento
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('pacote_noiva', 'Especialista em Pacote de Noiva', 'Bridal Package Specialist', 'eventos_beleza', 'Penteado, maquiagem e preparação completa para noivas.'),
  ('aluguel_vestido', 'Locador de Vestidos de Festa', 'Dress Rental Provider', 'eventos_beleza', 'Locação de vestidos para festas e cerimônias.'),
  ('consultor_imagem', 'Consultor de Imagem e Estilo', 'Image and Style Consultant', 'eventos_beleza', 'Aconselhamento estético e de vestuário para ocasiões especiais.')
ON CONFLICT (function_code) DO NOTHING;

-- ✅ ÁREAS DO SETOR DOMÉSTICO (Consolidado e sem redundância)
INSERT INTO profession_area (area_code, label_pt, label_en, sector_code, description) VALUES
  ('limpeza_domestica', 'Limpeza Residencial', 'Residential Cleaning', 'domestico', 'Serviços de limpeza e conservação em residências.'),
  ('cozinha_domestica', 'Cozinha Doméstica', 'Home Cooking', 'domestico', 'Preparo de refeições no ambiente familiar.'),
  ('lavanderia_domestica', 'Lavanderia e Passadoria', 'Laundry and Ironing', 'domestico', 'Lavagem, secagem e passagem de roupas.'),
  ('apoio_infantil', 'Apoio Infantil', 'Childcare Support', 'domestico', 'Cuidados com crianças no ambiente doméstico.'),
  ('cuidados_idosos', 'Cuidados com Idosos', 'Elderly Care', 'domestico', 'Acompanhamento e apoio a idosos no lar.'),
  ('manutencao_domestica', 'Manutenção Doméstica', 'Home Maintenance', 'domestico', 'Pequenos reparos, suporte e manutenção em residências.'),
  ('cuidados_pessoais', 'Cuidados Pessoais', 'Personal Care', 'domestico', 'Assistência em atividades pessoais no ambiente domiciliar.')
ON CONFLICT (area_code) DO NOTHING;

-- ✅ FUNÇÕES — DOMÉSTICO (Corrigidas e padronizadas)
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  -- Limpeza
  ('faxineira', 'Faxineira / Doméstica', 'House Cleaner / Maid', 'limpeza_domestica', 'Limpeza geral e manutenção da casa.'),
  ('diarista', 'Diarista', 'Daily Cleaner', 'limpeza_domestica', 'Limpeza por diária em residências.'),
  ('auxiliar_limpeza_domestica', 'Auxiliar de Limpeza Doméstica', 'Domestic Cleaning Assistant', 'limpeza_domestica', 'Suporte nas tarefas de limpeza e conservação.'),

  -- Cozinha
  ('cozinheira_domestica', 'Cozinheira Doméstica', 'Home Cook', 'cozinha_domestica', 'Preparo de refeições em ambiente residencial.'),
  ('auxiliar_cozinha_domestica', 'Auxiliar de Cozinha Doméstica', 'Home Kitchen Assistant', 'cozinha_domestica', 'Apoio no preparo e organização da cozinha.'),

  -- Lavanderia
  ('lavanderia_domestica', 'Profissional de Lavanderia', 'Laundry Worker', 'lavanderia_domestica', 'Lava, seca e organiza roupas.'),
  ('passadeira', 'Passadeira', 'Ironing Assistant', 'lavanderia_domestica', 'Passa roupas e cuida da apresentação de peças.'),

  -- Infantil
  ('baba', 'Babá', 'Babysitter', 'apoio_infantil', 'Cuida de crianças no ambiente doméstico.'),
  ('recreadora_infantil', 'Recreadora Infantil', 'Child Recreational Worker', 'apoio_infantil', 'Atividades lúdicas e pedagógicas com crianças.'),

  -- Idosos
  ('cuidador_idosos', 'Cuidador de Idosos', 'Elderly Caregiver', 'cuidados_idosos', 'Apoio e cuidados com idosos no ambiente domiciliar.'),
  ('acompanhante_idosos', 'Acompanhante de Idosos', 'Elderly Companion', 'cuidados_idosos', 'Companhia e auxílio em atividades diárias.'),

  -- Manutenção
  ('caseiro', 'Caseiro de Residência', 'House Caretaker', 'manutencao_domestica', 'Responsável por cuidar da casa e manutenções básicas.'),
  ('jardineiro_domestico', 'Jardineiro Doméstico', 'Home Gardener', 'manutencao_domestica', 'Cuida do jardim e áreas externas da residência.')
ON CONFLICT (function_code) DO NOTHING;

-- ✅ ÁREAS DO SETOR CONSTRUÇÃO E REFORMAS
INSERT INTO profession_area (area_code, label_pt, label_en, sector_code, description) VALUES
  ('alvenaria', 'Alvenaria', 'Masonry', 'construcao-e-reformas', 'Serviços de alvenaria e construção básica.'),
  ('estrutura', 'Estrutura e Concreto', 'Structure and Concrete', 'construcao-e-reformas', 'Estruturação, fundações, telhados.'),
  ('eletrica', 'Elétrica', 'Electrical', 'construcao-e-reformas', 'Instalações e projetos elétricos.'),
  ('hidraulica', 'Hidráulica', 'Plumbing', 'construcao-e-reformas', 'Serviços hidráulicos e redes de água.'),
  ('pintura', 'Pintura', 'Painting', 'construcao-e-reformas', 'Pintura, acabamento e texturas.'),
  ('externa', 'Área Externa e Terrenos', 'Outdoor and Yard Services', 'construcao-e-reformas', 'Limpeza, jardinagem, terrenos e locações.')
ON CONFLICT (area_code) DO NOTHING;

-- ✅ FUNÇÕES DO SETOR CONSTRUÇÃO E REFORMAS

-- Alvenaria
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('engenheiro_obras', 'Engenheiro de Obras', 'Construction Engineer', 'alvenaria', 'Responsável técnico pela execução de obras.'),
  ('construtor_reformas', 'Profissional de Reforma', 'Renovation Worker', 'alvenaria', 'Atua em reformas e pequenas construções.')
ON CONFLICT (function_code) DO NOTHING;

-- Estrutura
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('engenheiro_civil', 'Engenheiro Civil', 'Civil Engineer', 'estrutura', 'Planejamento e supervisão de obras civis.'),
  ('telhadista', 'Construtor de Telhados', 'Roofer', 'estrutura', 'Especialista em montagem de telhados.'),
  ('reparador_telhado', 'Reparador de Telhado', 'Roof Repair Technician', 'estrutura', 'Repara e substitui telhados danificados.'),
  ('limpeza_telhado', 'Limpeza de Telhado', 'Roof Cleaner', 'estrutura', 'Serviço de higienização de telhados.')
ON CONFLICT (function_code) DO NOTHING;

-- Elétrica
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('instalador_solar', 'Instalador de Placa Solar', 'Solar Panel Installer', 'eletrica', 'Instala painéis solares em residências e empresas.'),
  ('engenheiro_eletricista', 'Engenheiro Eletricista', 'Electrical Engineer', 'eletrica', 'Responsável por projetos e execução elétrica.')
ON CONFLICT (function_code) DO NOTHING;

-- Hidráulica
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('engenheiro_hidraulico', 'Engenheiro Hidráulico', 'Hydraulic Engineer', 'hidraulica', 'Projetos e supervisão de redes hidráulicas.'),
  ('limpeza_caixa_agua', 'Limpeza de Caixa D’Água', 'Water Tank Cleaner', 'hidraulica', 'Higienização de reservatórios.')
ON CONFLICT (function_code) DO NOTHING;

-- Pintura
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('aplicador_grafiato', 'Aplicador de Grafiato', 'Grafiato Texture Finisher', 'pintura', 'Aplicação de texturas como grafiato e similares.')
ON CONFLICT (function_code) DO NOTHING;

-- Externa
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('cortador_grama', 'Cortador de Grama', 'Lawn Mower Operator', 'externa', 'Corte e manutenção de gramados.'),
  ('jardineiro', 'Jardineiro', 'Gardener', 'externa', 'Cuidados com jardins e paisagismo.'),
  ('limpeza_terreno', 'Limpeza de Terreno', 'Land Cleaner', 'externa', 'Limpeza e preparação de terrenos.'),
  ('limpeza_quintal', 'Limpeza de Quintal', 'Backyard Cleaner', 'externa', 'Organização e limpeza de quintais.'),
  ('operador_maquinas', 'Operador de Máquinas', 'Machine Operator', 'externa', 'Opera máquinas e equipamentos pesados.'),
  ('locador_equipamentos', 'Locador de Equipamentos', 'Equipment Rental Provider', 'externa', 'Locação de equipamentos para construção.')
ON CONFLICT (function_code) DO NOTHING;

-- 📚 ÁREAS DO SETOR EDUCAÇÃO
INSERT INTO profession_area (area_code, label_pt, label_en, sector_code, description) VALUES
  ('reforco_escolar', 'Reforço Escolar', 'Tutoring', 'educacao', 'Aulas de reforço em diversas matérias para alunos de diferentes níveis.'),
  ('educacao_infantil', 'Educação Infantil', 'Early Childhood Education', 'educacao', 'Ensino e cuidado de crianças na primeira infância.'),
  ('idiomas', 'Ensino de Idiomas', 'Language Teaching', 'educacao', 'Aulas de línguas estrangeiras para diferentes faixas etárias.'),
  ('ensino_medio', 'Ensino Médio e Vestibular', 'High School and College Prep', 'educacao', 'Preparação para ENEM, vestibulares e matérias do ensino médio.'),
  ('ensino_superior', 'Ensino Superior', 'Higher Education', 'educacao', 'Aulas e monitorias para cursos universitários.'),
  ('musica', 'Aulas de Música', 'Music Lessons', 'educacao', 'Ensino de instrumentos, canto e teoria musical.'),
  ('aulas_tecnicas', 'Aulas Técnicas e Profissionalizantes', 'Technical and Vocational Training', 'educacao', 'Capacitação para o mercado de trabalho em áreas específicas.'),
  ('educacao_especial', 'Educação Especial e Inclusiva', 'Special and Inclusive Education', 'educacao', 'Acompanhamento de alunos com necessidades especiais.')
ON CONFLICT (area_code) DO NOTHING;

-- 👩‍🏫 FUNÇÕES — EDUCAÇÃO

-- Reforço Escolar
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('professor_reforco', 'Professor de Reforço Escolar', 'School Tutor', 'reforco_escolar', 'Aulas de apoio nas disciplinas escolares.'),
  ('monitor_escolar', 'Monitor Escolar', 'Classroom Monitor', 'reforco_escolar', 'Acompanhamento e suporte em sala de aula.')
ON CONFLICT (function_code) DO NOTHING;

-- Educação Infantil
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('professor_infantil', 'Professor de Educação Infantil', 'Early Childhood Teacher', 'educacao_infantil', 'Ensina e cuida de crianças pequenas.'),
  ('auxiliar_creche', 'Auxiliar de Creche', 'Daycare Assistant', 'educacao_infantil', 'Auxilia no cuidado e atividades com crianças.')
ON CONFLICT (function_code) DO NOTHING;

-- Idiomas
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('professor_ingles', 'Professor de Inglês', 'English Teacher', 'idiomas', 'Ensina inglês para diversos níveis.'),
  ('professor_espanhol', 'Professor de Espanhol', 'Spanish Teacher', 'idiomas', 'Ensina espanhol para iniciantes ou avançados.'),
  ('professor_portugues', 'Professor de Português', 'Portuguese Teacher', 'idiomas', 'Ensina língua portuguesa para brasileiros ou estrangeiros.')
ON CONFLICT (function_code) DO NOTHING;

-- Ensino Médio e Vestibular
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('professor_matematica', 'Professor de Matemática', 'Math Teacher', 'ensino_medio', 'Aulas de matemática para ensino médio e vestibular.'),
  ('professor_quimica', 'Professor de Química', 'Chemistry Teacher', 'ensino_medio', 'Prepara alunos para provas e vestibulares.'),
  ('professor_redacao', 'Professor de Redação', 'Writing Coach', 'ensino_medio', 'Ajuda na estruturação e escrita de textos.')
ON CONFLICT (function_code) DO NOTHING;

-- Ensino Superior
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('monitor_universitario', 'Monitor Universitário', 'University Teaching Assistant', 'ensino_superior', 'Auxilia alunos de graduação com conteúdos acadêmicos.'),
  ('professor_universitario', 'Professor Universitário', 'University Professor', 'ensino_superior', 'Docente em instituições de ensino superior.')
ON CONFLICT (function_code) DO NOTHING;

-- Música
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('professor_violao', 'Professor de Violão', 'Guitar Teacher', 'musica', 'Ensina técnica e teoria para violão.'),
  ('professor_canto', 'Professor de Canto', 'Vocal Coach', 'musica', 'Ensina técnicas vocais e interpretação.'),
  ('professor_teclado', 'Professor de Teclado / Piano', 'Keyboard Teacher', 'musica', 'Ensina instrumentos de teclas.')
ON CONFLICT (function_code) DO NOTHING;

-- Aulas Técnicas
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('instrutor_informatica', 'Instrutor de Informática', 'Computer Instructor', 'aulas_tecnicas', 'Ensina uso de computadores e softwares.'),
  ('instrutor_cabeleireiro', 'Instrutor de Cabeleireiro', 'Hairdressing Trainer', 'aulas_tecnicas', 'Capacita profissionais da beleza.'),
  ('instrutor_eletrica', 'Instrutor de Elétrica', 'Electrical Trainer', 'aulas_tecnicas', 'Ensina conceitos básicos e avançados de elétrica.')
ON CONFLICT (function_code) DO NOTHING;

-- Educação Especial
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('cuidador_educacional', 'Cuidador Educacional', 'Educational Caregiver', 'educacao_especial', 'Apoia alunos com necessidades especiais.'),
  ('professor_aee', 'Professor de AEE', 'Special Education Teacher', 'educacao_especial', 'Atua com Atendimento Educacional Especializado.')
ON CONFLICT (function_code) DO NOTHING;

-- 🎉 ÁREAS DO SETOR EVENTOS
INSERT INTO profession_area (area_code, label_pt, label_en, sector_code, description) VALUES
  ('organizacao_eventos', 'Organização de Eventos', 'Event Planning', 'eventos', 'Planejamento, coordenação e execução de eventos.'),
  ('buffet_evento', 'Buffet e Catering (Eventos)', 'Buffet and Catering', 'eventos', 'Serviços de alimentação para eventos.'),
  ('cerimonial', 'Cerimonial e Protocolo', 'Ceremonial and Protocol', 'eventos', 'Condução formal de cerimônias.'),
  ('estrutura_evento', 'Estrutura e Montagem', 'Setup and Logistics', 'eventos', 'Montagem de tendas, mesas, som, iluminação.'),
  ('animacao', 'Animação e Entretenimento', 'Entertainment and Animation', 'eventos', 'Shows, recreação e performances em eventos.'),
  ('recepcao', 'Recepção e Atendimento', 'Reception and Guest Services', 'eventos', 'Recepção de convidados, portaria, entrada.'),
  ('seguranca_evento', 'Segurança de Eventos', 'Event Security', 'eventos', 'Controle de acesso e segurança em eventos.')
ON CONFLICT (area_code) DO NOTHING;

-- 🎤 FUNÇÕES — EVENTOS E CASAMENTOS

-- Organização de Eventos
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('organizador_evento', 'Organizador de Eventos', 'Event Organizer', 'organizacao_eventos', 'Planeja e gerencia eventos de diversos tipos.'),
  ('assistente_evento', 'Assistente de Evento', 'Event Assistant', 'organizacao_eventos', 'Auxilia na logística e organização no dia do evento.')
ON CONFLICT (function_code) DO NOTHING;

-- Buffet e Catering
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('cozinheiro_buffet', 'Cozinheiro para Buffet', 'Buffet Cook', 'buffet_evento', 'Prepara refeições para eventos e banquetes.'),
  ('garcom_evento', 'Garçom para Eventos', 'Event Waiter', 'buffet_evento', 'Atende convidados durante eventos.'),
  ('montador_mesa', 'Montador de Mesa / Buffet', 'Buffet Table Assembler', 'buffet_evento', 'Montagem e organização de mesas em eventos.'),
  ('auxiliar_buffet', 'Auxiliar de Buffet', 'Buffet Assistant', 'buffet_evento', 'Apoio na preparação e reposição de alimentos.')
ON CONFLICT (function_code) DO NOTHING;

-- Cerimonial
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('cerimonialista', 'Cerimonialista', 'Ceremonial Planner', 'cerimonial', 'Organiza cerimônias e cronogramas de eventos.'),
  ('mestre_cerimonia', 'Mestre de Cerimônias', 'Master of Ceremonies', 'cerimonial', 'Conduz o evento com falas e apresentações.')
ON CONFLICT (function_code) DO NOTHING;

-- Estrutura e Montagem
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('montador_evento', 'Montador de Estrutura de Evento', 'Event Setup Technician', 'estrutura_evento', 'Montagem de palcos, tendas, iluminação e som.'),
  ('tecnico_som_luz', 'Técnico de Som e Luz', 'Sound and Light Technician', 'estrutura_evento', 'Operação de equipamentos de áudio e iluminação.')
ON CONFLICT (function_code) DO NOTHING;

-- Animação e Entretenimento
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('animador', 'Animador de Eventos', 'Event Entertainer', 'animacao', 'Realiza atividades de entretenimento com o público.'),
  ('dj', 'DJ / Disc Jockey', 'DJ', 'animacao', 'Responsável pela música durante o evento.')
ON CONFLICT (function_code) DO NOTHING;

-- Recepção
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('recepcionista_evento', 'Recepcionista de Evento', 'Event Receptionist', 'recepcao', 'Recebe e orienta convidados.'),
  ('hostess', 'Hostess / Anfitriã', 'Hostess', 'recepcao', 'Recebe convidados com atenção e direciona ao local.')
ON CONFLICT (function_code) DO NOTHING;

-- Segurança
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('seguranca_evento', 'Segurança para Eventos', 'Event Security Guard', 'seguranca_evento', 'Zela pela ordem e segurança durante eventos.')
ON CONFLICT (function_code) DO NOTHING;

-- 🏥 ÁREAS DO SETOR SAÚDE
INSERT INTO profession_area (area_code, label_pt, label_en, sector_code, description) VALUES
  ('enfermagem', 'Enfermagem', 'Nursing', 'saude', 'Cuidados diretos com pacientes e suporte clínico.'),
  ('medicina', 'Medicina', 'Medicine', 'saude', 'Diagnóstico e tratamento médico.'),
  ('fisioterapia', 'Fisioterapia', 'Physiotherapy', 'saude', 'Tratamentos de reabilitação e mobilidade.'),
  ('psicologia', 'Psicologia', 'Psychology', 'saude', 'Atendimento psicológico e emocional.'),
  ('nutricao', 'Nutrição', 'Nutrition', 'saude', 'Orientação alimentar e dietas personalizadas.'),
  ('atendimento_domiciliar', 'Atendimento Domiciliar', 'Home Health Care', 'saude', 'Serviços de saúde realizados no domicílio.'),
  ('tecnicos_saude', 'Técnicos de Saúde', 'Healthcare Technicians', 'saude', 'Funções técnicas em clínicas, laboratórios e hospitais.')
ON CONFLICT (area_code) DO NOTHING;

-- 👩‍⚕️ FUNÇÕES DO SETOR SAÚDE

-- Enfermagem
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('auxiliar_enfermagem', 'Auxiliar de Enfermagem', 'Nursing Assistant', 'enfermagem', 'Apoio básico em cuidados com pacientes.'),
  ('tecnico_enfermagem', 'Técnico de Enfermagem', 'Nursing Technician', 'enfermagem', 'Administra medicação e cuida de pacientes em clínicas e hospitais.'),
  ('enfermeiro', 'Enfermeiro(a)', 'Nurse', 'enfermagem', 'Responsável por procedimentos clínicos e supervisão de cuidados.')
ON CONFLICT (function_code) DO NOTHING;

-- Medicina
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('medico_clinico', 'Médico Clínico Geral', 'General Practitioner', 'medicina', 'Diagnóstico e tratamento de problemas gerais de saúde.'),
  ('medico_familia', 'Médico da Família', 'Family Doctor', 'medicina', 'Cuida da saúde integral do paciente e família.'),
  ('medico_especialista', 'Médico Especialista', 'Medical Specialist', 'medicina', 'Atua em áreas médicas específicas.')
ON CONFLICT (function_code) DO NOTHING;

-- Fisioterapia
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('fisioterapeuta', 'Fisioterapeuta', 'Physiotherapist', 'fisioterapia', 'Reabilitação física e tratamento de lesões.'),
  ('fisioterapeuta_domiciliar', 'Fisioterapeuta Domiciliar', 'Home Physiotherapist', 'fisioterapia', 'Atendimento fisioterápico em casa.')
ON CONFLICT (function_code) DO NOTHING;

-- Psicologia
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('psicologo', 'Psicólogo(a)', 'Psychologist', 'psicologia', 'Atendimento psicológico individual ou em grupo.'),
  ('psicologo_escolar', 'Psicólogo Escolar', 'School Psychologist', 'psicologia', 'Atua no ambiente educacional com alunos e professores.')
ON CONFLICT (function_code) DO NOTHING;

-- Nutrição
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('nutricionista', 'Nutricionista', 'Nutritionist', 'nutricao', 'Avaliação e orientação alimentar personalizada.')
ON CONFLICT (function_code) DO NOTHING;

-- Atendimento Domiciliar
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('cuidador_domiciliar', 'Cuidador de Pacientes em Casa', 'Home Health Aide', 'atendimento_domiciliar', 'Cuidados não hospitalares no domicílio.'),
  ('tecnico_domiciliar', 'Técnico de Enfermagem Domiciliar', 'Home Care Nursing Technician', 'atendimento_domiciliar', 'Procedimentos técnicos realizados na residência.')
ON CONFLICT (function_code) DO NOTHING;

-- Técnicos de Saúde
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('tecnico_laboratorio', 'Técnico de Laboratório', 'Lab Technician', 'tecnicos_saude', 'Realiza coletas e análises laboratoriais.'),
  ('tecnico_radiologia', 'Técnico em Radiologia', 'Radiology Technician', 'tecnicos_saude', 'Opera equipamentos de imagem como raio-X e tomógrafo.')
ON CONFLICT (function_code) DO NOTHING;

-- ✅ ÁREAS DO SETOR TECNOLOGIA
INSERT INTO profession_area (area_code, label_pt, label_en, sector_code, description) VALUES
  ('suporte_ti', 'Suporte Técnico em TI', 'IT Support', 'tecnologia', 'Atendimento e resolução de problemas técnicos.'),
  ('desenvolvimento', 'Desenvolvimento de Software', 'Software Development', 'tecnologia', 'Criação e manutenção de sistemas e aplicativos.'),
  ('infraestrutura', 'Infraestrutura de TI', 'IT Infrastructure', 'tecnologia', 'Gerenciamento de servidores, redes e equipamentos.'),
  ('design_uxui', 'Design e Experiência do Usuário', 'Design and User Experience', 'tecnologia', 'Criação de interfaces e usabilidade.'),
  ('analise_dados', 'Dados e Inteligência de Negócios (BI)', 'Data and Business Intelligence', 'tecnologia', 'Análise e modelagem de dados.'),
  ('seguranca_cibernetica', 'Segurança da Informação', 'Cybersecurity', 'tecnologia', 'Proteção contra ameaças e vazamentos de dados.')
ON CONFLICT (area_code) DO NOTHING;

-- 👨‍💻 FUNÇÕES DO SETOR TECNOLOGIA

-- Suporte Técnico
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('tecnico_suporte', 'Técnico de Suporte em TI', 'IT Support Technician', 'suporte_ti', 'Atende chamados técnicos e resolve problemas em equipamentos e redes.'),
  ('analista_helpdesk', 'Analista de Help Desk', 'Help Desk Analyst', 'suporte_ti', 'Presta suporte remoto e registra incidentes.')
ON CONFLICT (function_code) DO NOTHING;

-- Desenvolvimento
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('desenvolvedor_frontend', 'Desenvolvedor Front-end', 'Front-End Developer', 'desenvolvimento', 'Cria interfaces de usuário para web ou apps.'),
  ('desenvolvedor_backend', 'Desenvolvedor Back-end', 'Back-End Developer', 'desenvolvimento', 'Responsável pela lógica e dados do sistema.'),
  ('desenvolvedor_fullstack', 'Desenvolvedor Full Stack', 'Full Stack Developer', 'desenvolvimento', 'Atua tanto no front-end quanto no back-end.')
ON CONFLICT (function_code) DO NOTHING;

-- Infraestrutura
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('analista_rede', 'Analista de Redes', 'Network Analyst', 'infraestrutura', 'Gerencia redes, roteadores e switches.'),
  ('admin_servidores', 'Administrador de Servidores', 'Server Administrator', 'infraestrutura', 'Monitora e configura servidores locais ou em nuvem.')
ON CONFLICT (function_code) DO NOTHING;

-- Design e UX
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('designer_ui', 'Designer de Interfaces (UI)', 'UI Designer', 'design_uxui', 'Cria interfaces visuais para sistemas e sites.'),
  ('designer_ux', 'Designer de Experiência do Usuário (UX)', 'UX Designer', 'design_uxui', 'Melhora usabilidade e jornada do usuário.')
ON CONFLICT (function_code) DO NOTHING;

-- Dados e BI
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('analista_dados', 'Analista de Dados', 'Data Analyst', 'analise_dados', 'Coleta, trata e interpreta dados para decisões estratégicas.'),
  ('cientista_dados', 'Cientista de Dados', 'Data Scientist', 'analise_dados', 'Cria modelos estatísticos e algoritmos de predição.')
ON CONFLICT (function_code) DO NOTHING;

-- Segurança da Informação
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('analista_seg_info', 'Analista de Segurança da Informação', 'Information Security Analyst', 'seguranca_cibernetica', 'Monitora e protege redes e dados contra ataques.'),
  ('especialista_ciberseguranca', 'Especialista em Cibersegurança', 'Cybersecurity Specialist', 'seguranca_cibernetica', 'Planeja políticas e defesas contra ameaças digitais.')
ON CONFLICT (function_code) DO NOTHING;

-- ✅ ÁREAS DO SETOR LOGÍSTICA E TRANSPORTE
INSERT INTO profession_area (area_code, label_pt, label_en, sector_code, description) VALUES
  ('entregas', 'Entregas e Coletas', 'Deliveries and Pickups', 'logistica', 'Serviços de entrega urbana, interestadual e logística reversa.'),
  ('motoristas', 'Motoristas e Condutores', 'Drivers and Transport Operators', 'logistica', 'Transporte de pessoas e mercadorias.'),
  ('almoxarifado', 'Almoxarifado e Armazenagem', 'Stockroom and Storage', 'logistica', 'Organização e controle de estoque.'),
  ('expedicao', 'Expedição e Separação', 'Shipping and Picking', 'logistica', 'Separação de pedidos, embalagem e conferência.'),
  ('carga_descarga', 'Carga e Descarga', 'Loading and Unloading', 'logistica', 'Movimentação e embarque de produtos.'),
  ('gestao_logistica', 'Gestão de Logística', 'Logistics Management', 'logistica', 'Planejamento de rotas, frotas e operações logísticas.')
ON CONFLICT (area_code) DO NOTHING;

-- 👷 FUNÇÕES DO SETOR LOGÍSTICA E TRANSPORTE

-- Entregas
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('motoboy', 'Motoboy / Entregador', 'Motorcycle Courier', 'entregas', 'Realiza entregas rápidas e urbanas.'),
  ('entregador_van', 'Entregador com Van / Utilitário', 'Van Delivery Driver', 'entregas', 'Transporta volumes maiores em regiões urbanas.'),
  ('ciclista_entregador', 'Entregador com Bicicleta', 'Bicycle Delivery Person', 'entregas', 'Entregas leves em pequenas distâncias.')
ON CONFLICT (function_code) DO NOTHING;

-- Motoristas
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('motorista_app', 'Motorista de Aplicativo', 'Rideshare Driver', 'motoristas', 'Transporte de passageiros via aplicativos.'),
  ('motorista_carreta', 'Motorista de Caminhão / Carreta', 'Truck Driver', 'motoristas', 'Transporte de cargas em longas distâncias.'),
  ('motorista_utilitario', 'Motorista Utilitário / Frotista', 'Utility Vehicle Driver', 'motoristas', 'Condução de veículos leves para empresas.')
ON CONFLICT (function_code) DO NOTHING;

-- Almoxarifado
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('almoxarife', 'Almoxarife', 'Stock Clerk', 'almoxarifado', 'Organiza e controla o estoque físico.'),
  ('aux_almoxarifado', 'Auxiliar de Almoxarifado', 'Stockroom Assistant', 'almoxarifado', 'Apoia na movimentação e organização de materiais.')
ON CONFLICT (function_code) DO NOTHING;

-- Expedição
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('separador_pedidos', 'Separador de Pedidos', 'Order Picker', 'expedicao', 'Separa produtos conforme nota ou pedido.'),
  ('conferente', 'Conferente de Carga', 'Cargo Checker', 'expedicao', 'Confere volumes, lacres e notas fiscais.')
ON CONFLICT (function_code) DO NOTHING;

-- Carga e Descarga
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('ajudante_carga', 'Ajudante de Carga e Descarga', 'Loading Assistant', 'carga_descarga', 'Auxilia no embarque e desembarque de produtos.'),
  ('operador_empilhadeira', 'Operador de Empilhadeira', 'Forklift Operator', 'carga_descarga', 'Movimenta cargas com empilhadeiras.')
ON CONFLICT (function_code) DO NOTHING;

-- Gestão de Logística
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  ('analista_logistica', 'Analista de Logística', 'Logistics Analyst', 'gestao_logistica', 'Planeja e monitora a operação logística.'),
  ('coordenador_frota', 'Coordenador de Frotas', 'Fleet Coordinator', 'gestao_logistica', 'Coordena motoristas, veículos e escalas.')
ON CONFLICT (function_code) DO NOTHING;

-- ✅ SETOR: SERVIÇOS EM GERAL (com campo description padronizado)
INSERT INTO profession_sector (code, label_pt, label_en, description)
VALUES (
  'servicos-em-geral',
  'Serviços em Geral',
  'General Services',
  'Serviços diversos de apoio, manutenção e conservação.'
)
ON CONFLICT (code) DO NOTHING;

-- 🛠️ ÁREAS DO SETOR SERVIÇOS EM GERAL
INSERT INTO profession_area (area_code, label_pt, label_en, sector_code, description) VALUES
  ('limpeza_comercial', 'Limpeza Comercial e Industrial', 'Commercial and Industrial Cleaning', 'servicos-em-geral', 'Serviços de limpeza em empresas, galpões e escritórios.'),
  ('zeladoria', 'Zeladoria e Portaria', 'Janitorial and Doorman Services', 'servicos-em-geral', 'Cuidado com áreas comuns e atendimento de portaria.'),
  ('manutencao_predial', 'Manutenção Predial', 'Building Maintenance', 'servicos-em-geral', 'Pequenos reparos e manutenção em prédios e condomínios.'),
  ('apoio_geral', 'Serviços de Apoio Geral', 'General Support Services', 'servicos-em-geral', 'Atividades diversas de apoio operacional.'),
  ('jardinagem', 'Jardinagem e Paisagismo', 'Gardening and Landscaping', 'servicos-em-geral', 'Cuidados com áreas verdes e ambientes externos.')
ON CONFLICT (area_code) DO NOTHING;

-- 🧹 FUNÇÕES DO SETOR SERVIÇOS EM GERAL
INSERT INTO profession_function (function_code, label_pt, label_en, area_code, description) VALUES
  -- Limpeza Comercial
  ('auxiliar_limpeza', 'Auxiliar de Limpeza', 'Cleaning Assistant', 'limpeza_comercial', 'Limpeza e conservação de espaços corporativos.'),
  ('faxineiro_industrial', 'Faxineiro Industrial', 'Industrial Cleaner', 'limpeza_comercial', 'Higienização em áreas industriais.'),

  -- Zeladoria
  ('zelador', 'Zelador / Zeladora', 'Janitor', 'zeladoria', 'Responsável por conservação e pequenos reparos em prédios.'),
  ('porteiro', 'Porteiro', 'Doorman', 'zeladoria', 'Controle de entrada, portaria e atendimento ao público.'),

  -- Manutenção Predial
  ('manutencao_predial', 'Auxiliar de Manutenção Predial', 'Building Maintenance Assistant', 'manutencao_predial', 'Executa serviços básicos de reparo em imóveis.'),
  ('eletricista_predial', 'Eletricista Predial', 'Building Electrician', 'manutencao_predial', 'Atua na manutenção elétrica de edifícios.'),

  -- Apoio Geral
  ('ajudante_geral_servicos', 'Ajudante Geral', 'General Services Helper', 'apoio_geral', 'Apoio operacional em tarefas diversas.'),
  ('carregador', 'Carregador / Auxiliar de Carga', 'Loader / Cargo Assistant', 'apoio_geral', 'Movimentação de mercadorias e objetos.'),

  -- Jardinagem
  ('jardineiro_comercial', 'Jardineiro de Áreas Verdes', 'Commercial Gardener', 'jardinagem', 'Cuida da manutenção de jardins e praças.'),
  ('paisagista', 'Paisagista', 'Landscaper', 'jardinagem', 'Planejamento e design de áreas verdes.')
ON CONFLICT (function_code) DO NOTHING;

CREATE TABLE user_profession_function (
  user_profile_id UUID REFERENCES user_profile(user_profile_id) ON DELETE CASCADE,
  function_code TEXT REFERENCES profession_function(function_code) ON DELETE CASCADE,
  PRIMARY KEY (user_profile_id, function_code),
  created_at TIMESTAMP DEFAULT now()
);

-- NÍVEL 2: Tópicos
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'hobby_topic') THEN
    CREATE TABLE hobby_topic (
      topic_code TEXT PRIMARY KEY,
      label_pt TEXT NOT NULL,
      label_en TEXT NOT NULL,
      category hobby_category NOT NULL,
      description TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now()
    );
  END IF;
END
$$;

-- NÍVEL 3: Hobbies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'hobby') THEN
    CREATE TABLE hobby (
      hobby_code TEXT PRIMARY KEY,
      label_pt TEXT NOT NULL,
      label_en TEXT NOT NULL,
      topic_code TEXT NOT NULL REFERENCES hobby_topic(topic_code) ON DELETE CASCADE,
      description TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now()
    );
  END IF;
END
$$;

-- User ↔ Hobbies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'user_hobby') THEN
    CREATE TABLE user_hobby (
      user_profile_id UUID REFERENCES user_profile(user_profile_id) ON DELETE CASCADE,
      hobby_code TEXT REFERENCES hobby(hobby_code) ON DELETE CASCADE,
      PRIMARY KEY (user_profile_id, hobby_code),
      created_at TIMESTAMP DEFAULT now()
    );
  END IF;
END
$$;

-- User ↔ Tópicos
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'user_hobby_topic') THEN
    CREATE TABLE user_hobby_topic (
      user_profile_id UUID REFERENCES user_profile(user_profile_id) ON DELETE CASCADE,
      topic_code TEXT REFERENCES hobby_topic(topic_code) ON DELETE CASCADE,
      PRIMARY KEY (user_profile_id, topic_code),
      created_at TIMESTAMP DEFAULT now()
    );
  END IF;
END
$$;

-- Inserts de hobby_topic
-- Tópicos (nível 2)
INSERT INTO hobby_topic (topic_code, label_pt, label_en, category, description)
VALUES
  -- Já existentes
  ('comedia_romantica', 'Comédia Romântica', 'Romantic Comedy', 'movies_and_series', 'Filmes leves com romance e humor.'),
  ('suspense_policial', 'Suspense Policial', 'Crime Thriller', 'movies_and_series', 'Mistérios e investigações criminais.'),
  ('drama_familiar', 'Drama Familiar', 'Family Drama', 'movies_and_series', 'Histórias emocionantes sobre relações familiares.'),
  ('aventura_fantastica', 'Aventura Fantástica', 'Fantasy Adventure', 'movies_and_series', 'Enredos de fantasia com jornadas épicas.'),
  ('acao_policial', 'Ação Policial', 'Action Police', 'movies_and_series', 'Filmes e séries com perseguições e missões policiais.'),
  ('documentarios_sociais', 'Documentários Sociais', 'Social Documentaries', 'movies_and_series', 'Produções que abordam temas sociais contemporâneos.'),
  ('comedia_satira', 'Comédia Satírica', 'Satirical Comedy', 'movies_and_series', 'Comédias que ironizam aspectos da sociedade.'),
  ('series_brasileiras', 'Séries Brasileiras', 'Brazilian Series', 'movies_and_series', 'Séries produzidas no Brasil com temáticas nacionais.'),
  ('hamburgueria', 'Hamburguerias', 'Burger Joints', 'food_and_drinks', 'Apreciadores de hambúrgueres artesanais.'),
  ('cerveja_artesanal', 'Cerveja Artesanal', 'Craft Beer', 'food_and_drinks', 'Interesse por cervejas especiais e artesanais.'),
  ('pizzarias', 'Pizzarias', 'Pizzerias', 'food_and_drinks', 'Explorar sabores e estilos de pizza, de forno à lenha a gourmet.'),
  ('cafeterias', 'Cafeterias', 'Coffee Shops', 'food_and_drinks', 'Interesse por cafés especiais, ambientes aconchegantes e degustações.'),
  ('culinaria_internacional', 'Culinária Internacional', 'International Cuisine', 'food_and_drinks', 'Experimentar comidas de diferentes culturas e países.'),
  ('culinaria_regional', 'Culinária Regional', 'Regional Cuisine', 'food_and_drinks', 'Explorar pratos típicos de diferentes regiões do Brasil.'),
  ('vinhos', 'Vinhos', 'Wines', 'food_and_drinks', 'Degustar vinhos, harmonizações e vinícolas.'),
  ('doces_caseiros', 'Doces Caseiros', 'Homemade Sweets', 'food_and_drinks', 'Apreciação por sobremesas feitas em casa ou artesanais.'),
  ('confeitaria_fina', 'Confeitaria Fina', 'Fine Pastry', 'food_and_drinks', 'Doces sofisticados e elaborados.'),
  ('food_trucks', 'Food Trucks', 'Food Trucks', 'food_and_drinks', 'Explorar comidas de rua modernas e criativas.'),
  ('mercados_gastronomicos', 'Mercados Gastronômicos', 'Gastronomic Markets', 'food_and_drinks', 'Frequentar espaços coletivos com variedade de opções.'),
  ('churrasco', 'Churrasco', 'Barbecue', 'food_and_drinks', 'Preparar e apreciar churrascos com amigos e família.'),
  ('culinaria_vegetariana', 'Culinária Vegetariana', 'Vegetarian Cuisine', 'food_and_drinks', 'Pratos sem carne com foco em sabor e criatividade.'),
  ('culinaria_vegana', 'Culinária Vegana', 'Vegan Cuisine', 'food_and_drinks', 'Alimentação sem origem animal com estilo e sabor.'),
  ('cozinha_afetiva', 'Cozinha Afetiva', 'Comfort Food', 'food_and_drinks', 'Comidas que remetem a lembranças, aconchego e tradições familiares.'),
  ('brunches', 'Brunches', 'Brunches', 'food_and_drinks', 'Refeições intermediárias com variedade e estilo.'),
  ('degustacoes_gastronomicas', 'Degustações Gastronômicas', 'Gastronomic Tastings', 'food_and_drinks', 'Vivenciar experiências com menus degustação e harmonizações.'),
  ('restaurantes_tematicos', 'Restaurantes Temáticos', 'Themed Restaurants', 'food_and_drinks', 'Ambientes com propostas únicas e experiências sensoriais.'),
  ('delivery_gourmet', 'Delivery Gourmet', 'Gourmet Delivery', 'food_and_drinks', 'Descobrir comidas especiais por aplicativos e entregas.'),
  ('cozinha_autoral', 'Cozinha Autoral', 'Signature Cuisine', 'food_and_drinks', 'Explorar pratos criativos de chefs com identidade própria.'),
  ('futebol', 'Futebol', 'Soccer', 'sports', 'Modalidade esportiva popular e coletiva.'),
  ('corrida_de_rua', 'Corrida de Rua', 'Street Running', 'sports', 'Prática de corrida como hobby e bem-estar.'),
  ('rock_nacional', 'Rock Nacional', 'Brazilian Rock', 'music', 'Bandas e clássicos do rock brasileiro.'),
  ('mpb', 'MPB', 'Brazilian Popular Music', 'music', 'Música popular brasileira em suas diversas formas.'),
  ('ficcao', 'Ficção Científica', 'Science Fiction', 'reading', 'Livros de ficção com temas futuristas.'),
  ('autoajuda', 'Autoajuda', 'Self-help', 'reading', 'Livros motivacionais e de crescimento pessoal.'),
  ('gadgets', 'Tecnologia e Gadgets', 'Technology and Gadgets', 'technology', 'Interesse por inovações tecnológicas e eletrônicos.'),
  ('eventos_culturais', 'Eventos Culturais', 'Cultural Events', 'events', 'Participação em eventos culturais e sociais.'),
  ('viagens_curta', 'Viagens Curtas', 'Short Trips', 'travel', 'Viagens de final de semana ou feriados.'),
  ('bem_estar_mental', 'Bem-estar Mental', 'Mental Wellness', 'wellness', 'Atividades que promovem equilíbrio emocional.'),
  ('gastronomia_caseira', 'Gastronomia Caseira', 'Home Cooking', 'gastronomy', 'Cozinhar em casa com prazer e criatividade.'),
  ('pintura', 'Pintura e Artes Visuais', 'Painting and Visual Arts', 'art', 'Expressão artística através da pintura.'),
  ('cultura_geek', 'Cultura Geek', 'Geek Culture', 'nerd_stuff', 'Interesse por animes, HQs, filmes e jogos geeks.'),
  ('passeios_urbanos', 'Passeios Urbanos', 'Urban Exploration', 'around_the_city', 'Explorar bairros, centros históricos e cafés locais.')
ON CONFLICT DO NOTHING;

-- Hobbies (nível 3)
INSERT INTO hobby (hobby_code, label_pt, label_en, topic_code, description, is_active)
VALUES
  -- Já existentes
  ('filme_comedia_romantica', 'Filmes de comédia romântica', 'Romantic Comedy Movies', 'comedia_romantica', 'Assistir a filmes leves com romance e humor.', TRUE),
  ('serie_comedia_romantica', 'Séries de comédia romântica', 'Romantic Comedy Series', 'comedia_romantica', 'Séries com enredos românticos e cômicos.', TRUE),
  ('filme_suspense_policial', 'Filmes de suspense policial', 'Crime Thriller Movies', 'suspense_policial', 'Filmes com investigações e mistérios.', TRUE),
  ('serie_suspense_policial', 'Séries de suspense policial', 'Crime Thriller Series', 'suspense_policial', 'Séries investigativas e com reviravoltas.', TRUE),
  ('assistir_drama_familiar', 'Assistir dramas familiares', 'Watch Family Dramas', 'drama_familiar', 'Assistir a filmes e séries que exploram relações familiares intensas.', TRUE),
  ('indicar_drama_familiar', 'Indicar dramas familiares', 'Recommend Family Dramas', 'drama_familiar', 'Compartilhar recomendações de filmes e séries dramáticas familiares.', TRUE),
  ('maratonar_aventura_fantastica', 'Maratonar aventuras fantásticas', 'Binge Fantasy Adventures', 'aventura_fantastica', 'Assistir sagas e séries com mundos imaginários e jornadas épicas.', TRUE),
  ('ler_sobre_fantasia', 'Ler sobre fantasia', 'Read about Fantasy Worlds', 'aventura_fantastica', 'Explorar conteúdos literários e culturais sobre fantasia.', TRUE),
  ('assistir_acao_policial', 'Assistir ação policial', 'Watch Police Action Shows', 'acao_policial', 'Ver filmes e séries com perseguições e operações policiais.', TRUE),
  ('debater_acao_policial', 'Debater ação policial', 'Discuss Police Action', 'acao_policial', 'Discutir cenas e enredos intensos de ação policial.', TRUE),
  ('ver_documentarios_sociais', 'Ver documentários sociais', 'Watch Social Documentaries', 'documentarios_sociais', 'Assistir produções que abordam questões sociais e culturais.', TRUE),
  ('discutir_documentarios_sociais', 'Discutir documentários sociais', 'Discuss Social Documentaries', 'documentarios_sociais', 'Conversar sobre temas abordados em documentários.', TRUE),
  ('assistir_comedia_satira', 'Assistir comédia satírica', 'Watch Satirical Comedy', 'comedia_satira', 'Ver conteúdos que ironizam a sociedade com humor crítico.', TRUE),
  ('compartilhar_comedia_satira', 'Compartilhar sátiras favoritas', 'Share Satirical Comedy', 'comedia_satira', 'Compartilhar episódios e cenas satíricas marcantes.', TRUE),
  ('assistir_series_brasileiras', 'Assistir séries brasileiras', 'Watch Brazilian Series', 'series_brasileiras', 'Apreciar produções audiovisuais nacionais.', TRUE),
  ('indicar_series_brasileiras', 'Indicar séries brasileiras', 'Recommend Brazilian Series', 'series_brasileiras', 'Compartilhar boas séries brasileiras com amigos.', TRUE),
  ('visita_hamburguerias', 'Visitar hamburguerias', 'Visit Burger Joints', 'hamburgueria', 'Experimentar diferentes hambúrgueres e lugares.', TRUE),
  ('avaliador_hamburguer', 'Avaliar hambúrgueres', 'Burger Reviewer', 'hamburgueria', 'Fazer avaliações e notas sobre hambúrgueres.', TRUE),
  ('degustador_cerveja', 'Degustar cerveja artesanal', 'Craft Beer Taster', 'cerveja_artesanal', 'Experimentar e apreciar cervejas artesanais.', TRUE),
  ('eventos_cervejeiros', 'Ir a eventos de cerveja', 'Beer Festivals', 'cerveja_artesanal', 'Participar de eventos ou festivais cervejeiros.', TRUE),
  ('visitar_pizzarias', 'Visitar pizzarias diferentes', 'Visit Different Pizzerias', 'pizzarias', 'Explorar pizzarias com estilos variados e especialidades.', TRUE),
  ('avaliar_pizzas', 'Avaliar sabores de pizza', 'Review Pizza Flavors', 'pizzarias', 'Experimentar e classificar sabores e combinações.', TRUE),
  ('degustar_cafes', 'Degustar cafés especiais', 'Taste Special Coffees', 'cafeterias', 'Apreciar diferentes métodos e grãos de café.', TRUE),
  ('visitar_cafeterias', 'Conhecer cafeterias aconchegantes', 'Explore Cozy Coffee Shops', 'cafeterias', 'Frequentar cafeterias com bom ambiente e cardápio.', TRUE),
  ('explorar_cozinha_mundial', 'Explorar a culinária mundial', 'Explore Global Cuisine', 'culinaria_internacional', 'Provar pratos típicos de países diversos.', TRUE),
  ('cozinhar_receitas_internacionais', 'Cozinhar receitas internacionais', 'Cook International Recipes', 'culinaria_internacional', 'Preparar pratos famosos de outras culturas.', TRUE),
  ('provar_pratos_tipicos', 'Provar pratos típicos do Brasil', 'Taste Brazilian Regional Dishes', 'culinaria_regional', 'Experimentar comidas tradicionais de várias regiões.', TRUE),
  ('cozinhar_comida_regional', 'Cozinhar comida regional', 'Cook Regional Brazilian Food', 'culinaria_regional', 'Preparar receitas típicas como feijoada, moqueca, etc.', TRUE),
  ('degustar_vinhos', 'Degustar vinhos', 'Taste Wines', 'vinhos', 'Participar de degustações de vinhos.', TRUE),
  ('visitar_vinicolas', 'Visitar vinícolas', 'Visit Wineries', 'vinhos', 'Conhecer vinícolas e processos de produção.', TRUE),
  ('fazer_doces_caseiros', 'Fazer doces caseiros', 'Make Homemade Sweets', 'doces_caseiros', 'Preparar sobremesas tradicionais e afetivas.', TRUE),
  ('experimentar_sobremesas_artesanais', 'Experimentar sobremesas artesanais', 'Try Artisan Desserts', 'doces_caseiros', 'Provar doces feitos artesanalmente.', TRUE),
  ('visitar_confeitarias', 'Visitar confeitarias finas', 'Visit Fine Pastry Shops', 'confeitaria_fina', 'Explorar lojas com doces elaborados.', TRUE),
  ('apreciar_doces_gourmet', 'Apreciar doces gourmet', 'Enjoy Gourmet Desserts', 'confeitaria_fina', 'Degustar doces sofisticados e autorais.', TRUE),
  ('explorar_food_trucks', 'Explorar food trucks', 'Explore Food Trucks', 'food_trucks', 'Descobrir comidas de rua em caminhões e eventos.', TRUE),
  ('avaliar_comida_de_rua', 'Avaliar comida de rua', 'Review Street Food', 'food_trucks', 'Avaliar variedade, sabor e experiência.', TRUE),
  ('frequentar_mercados_gastronomicos', 'Frequentar mercados gastronômicos', 'Visit Gastronomic Markets', 'mercados_gastronomicos', 'Visitar espaços com diversidade culinária.', TRUE),
  ('descobrir_novos_produtos', 'Descobrir novos sabores e produtos', 'Discover New Foods and Products', 'mercados_gastronomicos', 'Experimentar novidades e produtos locais.', TRUE),
  ('preparar_churrasco', 'Preparar churrasco', 'Grill Barbecue', 'churrasco', 'Organizar e preparar churrascos com amigos.', TRUE),
  ('avaliar_cortes_carnes', 'Avaliar cortes e carnes', 'Review Meat Cuts', 'churrasco', 'Experimentar diferentes tipos e preparos de carne.', TRUE),
  ('cozinhar_pratos_vegetarianos', 'Cozinhar pratos vegetarianos', 'Cook Vegetarian Dishes', 'culinaria_vegetariana', 'Criar receitas sem carne com criatividade.', TRUE),
  ('visitar_restaurantes_veggie', 'Visitar restaurantes vegetarianos', 'Visit Vegetarian Restaurants', 'culinaria_vegetariana', 'Conhecer lugares com foco em comida vegetal.', TRUE),
  ('preparar_comida_vegana', 'Preparar comida vegana', 'Cook Vegan Food', 'culinaria_vegana', 'Cozinhar refeições 100% vegetais.', TRUE),
  ('seguir_receitas_veganas', 'Seguir receitas veganas', 'Follow Vegan Recipes', 'culinaria_vegana', 'Testar receitas e estilos de vida veganos.', TRUE),
  ('preparar_receitas_de_familia', 'Preparar receitas de família', 'Cook Family Recipes', 'cozinha_afetiva', 'Recriar pratos tradicionais e afetivos.', TRUE),
  ('cozinhar_para_amigos', 'Cozinhar para amigos', 'Cook for Friends', 'cozinha_afetiva', 'Preparar refeições para momentos especiais.', TRUE),
  ('fazer_brunch_em_casa', 'Fazer brunch em casa', 'Make Brunch at Home', 'brunches', 'Organizar cafés da manhã reforçados com estilo.', TRUE),
  ('experimentar_brunches', 'Experimentar brunches variados', 'Try Different Brunches', 'brunches', 'Ir a lugares com brunches criativos.', TRUE),
  ('participar_degustacoes', 'Participar de degustações', 'Attend Tastings', 'degustacoes_gastronomicas', 'Participar de eventos com menus e harmonizações.', TRUE),
  ('avaliar_experiencias', 'Avaliar experiências gastronômicas', 'Review Gastronomic Experiences', 'degustacoes_gastronomicas', 'Avaliar pratos e combinações de sabores.', TRUE),
  ('visitar_restaurantes_diferentes', 'Visitar restaurantes diferentes', 'Visit Unique Restaurants', 'restaurantes_tematicos', 'Conhecer lugares com ambientação especial.', TRUE),
  ('participar_experiencias_sensoriais', 'Participar de experiências sensoriais', 'Join Sensory Experiences', 'restaurantes_tematicos', 'Viver jantares com propostas imersivas.', TRUE),
  ('testar_delivery_gourmet', 'Testar delivery gourmet', 'Try Gourmet Delivery', 'delivery_gourmet', 'Pedir refeições elaboradas via aplicativo.', TRUE),
  ('avaliar_comida_entregue', 'Avaliar comida entregue', 'Review Delivered Food', 'delivery_gourmet', 'Avaliar sabor, embalagem e apresentação.', TRUE),
  ('experimentar_cozinha_autoral', 'Experimentar cozinha autoral', 'Try Signature Cuisine', 'cozinha_autoral', 'Provar pratos criados por chefs com identidade.', TRUE),
  ('acompanhar_chefs_autorais', 'Acompanhar chefs autorais', 'Follow Signature Chefs', 'cozinha_autoral', 'Seguir chefs e restaurantes inovadores.', TRUE),

  ('jogar_futebol_amador', 'Jogar futebol amador', 'Play Amateur Soccer', 'futebol', 'Praticar futebol com amigos ou equipes locais.', TRUE),
  ('acompanhar_futebol', 'Acompanhar futebol', 'Follow Soccer', 'futebol', 'Assistir jogos e acompanhar campeonatos.', TRUE),
  ('treino_corrida', 'Treinar corrida', 'Running Training', 'corrida_de_rua', 'Fazer treinos regulares de corrida.', TRUE),
  ('participar_corrida', 'Participar de provas', 'Join Running Events', 'corrida_de_rua', 'Participar de corridas de rua e eventos.', TRUE),
  ('ouvir_rock', 'Ouvir rock nacional', 'Listen to Brazilian Rock', 'rock_nacional', 'Ouvir músicas e bandas brasileiras de rock.', TRUE),
  ('ir_shows_rock', 'Ir a shows de rock', 'Attend Rock Concerts', 'rock_nacional', 'Participar de shows de rock ao vivo.', TRUE),
  ('playlist_mpb', 'Montar playlist MPB', 'Create MPB Playlist', 'mpb', 'Criar playlists com música popular brasileira.', TRUE),
  ('cantar_mpb', 'Cantar MPB', 'Sing MPB', 'mpb', 'Gostar de cantar músicas de MPB.', TRUE),
  ('ler_ficcao', 'Ler ficção científica', 'Read Science Fiction', 'ficcao', 'Livros com temas tecnológicos ou futuros distópicos.', TRUE),
  ('colecao_ficcao', 'Colecionar livros de ficção', 'Collect Sci-Fi Books', 'ficcao', 'Manter uma coleção temática de ficção.', TRUE),
  ('ler_autoajuda', 'Ler autoajuda', 'Read Self-help', 'autoajuda', 'Leitura voltada para crescimento pessoal.', TRUE),
  ('seguir_autores_motivacionais', 'Seguir autores motivacionais', 'Follow Motivational Authors', 'autoajuda', 'Acompanhar escritores de desenvolvimento pessoal.', TRUE),

  -- Novos hobbies
  ('usar_gadgets', 'Usar gadgets e eletrônicos', 'Using Gadgets', 'gadgets', 'Acompanhar e utilizar dispositivos tecnológicos.', TRUE),
  ('ir_eventos_culturais', 'Ir a eventos culturais', 'Go to Cultural Events', 'eventos_culturais', 'Frequentar shows, feiras e exposições.', TRUE),
  ('viajar_final_semana', 'Viajar em finais de semana', 'Weekend Trips', 'viagens_curta', 'Conhecer lugares próximos em viagens curtas.', TRUE),
  ('praticar_meditacao', 'Praticar meditação', 'Practice Meditation', 'bem_estar_mental', 'Buscar equilíbrio emocional através da meditação.', TRUE),
  ('cozinhar_em_casa', 'Cozinhar em casa', 'Home Cooking', 'gastronomia_caseira', 'Preparar refeições por prazer e criatividade.', TRUE),
  ('pintar_quadros', 'Pintar quadros', 'Painting', 'pintura', 'Expressar-se por meio da pintura.', TRUE),
  ('assistir_anime', 'Assistir anime', 'Watch Anime', 'cultura_geek', 'Gostar de animações japonesas.', TRUE),
  ('explorar_bairros', 'Explorar bairros e cidades', 'Explore Neighborhoods', 'passeios_urbanos', 'Passeios a pé por regiões urbanas.', TRUE)
ON CONFLICT (hobby_code) DO NOTHING;
-- Empresa
CREATE TABLE company (
  company_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL CHECK (char_length(name) > 0),
  cnpj BYTEA NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  company_type company_type,
  company_size company_size,
  company_sector company_sector,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Endereço da empresa
CREATE TABLE company_address (
  company_address_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company(company_id) ON DELETE CASCADE,
  street VARCHAR(255),
  number VARCHAR(20),
  complement VARCHAR(255),
  neighborhood_id UUID REFERENCES neighborhood(neighborhood_id),
  city_id UUID REFERENCES city(city_id),
  state_id UUID REFERENCES state(state_id),
  cep CHAR(8) CHECK (char_length(cep) = 8)
);

-- Categoria de empresa
CREATE TABLE company_category (
  company_category_id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  icon_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Funcionário da empresa
CREATE TABLE company_employee (
  company_employee_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company(company_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES "user"(user_id) ON DELETE CASCADE,
  role TEXT,
  status generic_status DEFAULT 'active',
  joined_at TIMESTAMP DEFAULT now()
);

-- Filial
CREATE TABLE company_branch (
  company_branch_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company(company_id) ON DELETE CASCADE,
  name VARCHAR(255),
  address_id UUID REFERENCES company_address(company_address_id),
  created_at TIMESTAMP DEFAULT now()
);

-- Perfil da empresa
CREATE TABLE company_profile (
  company_profile_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company(company_id) ON DELETE CASCADE,
  legal_representative_name VARCHAR(255),
  founding_date DATE,
  website VARCHAR(255),
  number_of_employees INTEGER,
  annual_revenue NUMERIC(14, 2),
  accepts_government_contracts BOOLEAN,
  has_innovation_area BOOLEAN,
  receives_investments BOOLEAN,
  created_at TIMESTAMP DEFAULT now()
);

-- Imagem de perfil
CREATE TABLE company_profile_image (
  company_profile_image_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company(company_id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- Imagem de capa
CREATE TABLE company_cover_image (
  company_cover_image_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company(company_id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  uploaded_by UUID REFERENCES user_profile(user_profile_id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP
);

-- Redes sociais
CREATE TABLE company_social_link (
  company_social_link_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company(company_id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  label VARCHAR(100),
  url TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP
);

-- Horários de funcionamento
CREATE TABLE company_schedule (
  schedule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company(company_id) ON DELETE CASCADE,
  day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
  opens_at TIME NOT NULL,
  closes_at TIME NOT NULL,
  is_open BOOLEAN DEFAULT true,
  is_holiday BOOLEAN DEFAULT false,
  is_weekend BOOLEAN DEFAULT false,
  is_temporary_block BOOLEAN DEFAULT false,
  block_reason TEXT,
  valid_from DATE,
  valid_until DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 🗓️ Schedule
CREATE TABLE schedule (
  schedule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company(company_id) ON DELETE CASCADE,
  user_profile_id UUID REFERENCES user_profile(user_profile_id) ON DELETE SET NULL,
  employee_id UUID REFERENCES company_employee(company_employee_id) ON DELETE SET NULL,
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  status VARCHAR(20) NOT NULL DEFAULT 'available',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP
);

-- 📌 Schedule Booking
CREATE TABLE schedule_booking (
  booking_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES schedule(schedule_id) ON DELETE CASCADE,
  user_profile_id UUID NOT NULL REFERENCES user_profile(user_profile_id) ON DELETE CASCADE,
  booking_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  booked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  rating SMALLINT CHECK (rating BETWEEN 1 AND 5),
  feedback TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP
);


-- Categoria de produto
CREATE TABLE product_category (
  category_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(80) NOT NULL,
  parent_category_id UUID REFERENCES product_category(category_id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP
);

-- Produto
CREATE TABLE product (
  product_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company(company_id) ON DELETE CASCADE,
  category_id UUID REFERENCES product_category(category_id),
  name VARCHAR(120) NOT NULL,
  description TEXT,
  price NUMERIC(10, 2) NOT NULL,
  stock_quantity INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP
);

-- Imagem do produto
CREATE TABLE product_image (
  image_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES product(product_id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  position INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Estoque do produto
CREATE TABLE product_stock (
  stock_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES product(product_id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  reserved INTEGER DEFAULT 0,
  min_threshold INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Histórico de preços
CREATE TABLE product_price_history (
  history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES product(product_id) ON DELETE CASCADE,
  old_price NUMERIC(10, 2),
  new_price NUMERIC(10, 2) NOT NULL,
  changed_by UUID REFERENCES user_profile(user_profile_id),
  change_reason TEXT,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Avaliações
CREATE TABLE review (
  review_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_user_id UUID REFERENCES "user"(user_id) ON DELETE SET NULL,
  target_type VARCHAR(30) NOT NULL,
  target_id UUID NOT NULL,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5) NOT NULL,
  comment TEXT,
  is_anonymous BOOLEAN DEFAULT false,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP
);

-- Permissões do funcionário
CREATE TABLE company_permission (
  company_permission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_employee_id UUID NOT NULL REFERENCES company_employee(company_employee_id) ON DELETE CASCADE,
  can_edit_profile BOOLEAN DEFAULT false,
  can_manage_products BOOLEAN DEFAULT false,
  can_manage_schedule BOOLEAN DEFAULT false,
  can_view_financials BOOLEAN DEFAULT false,
  can_manage_employees BOOLEAN DEFAULT false,
  can_manage_orders BOOLEAN DEFAULT false,
  can_edit_ads BOOLEAN DEFAULT false,
  can_view_insights BOOLEAN DEFAULT false,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP
);

-- Campos personalizados
CREATE TABLE company_custom_field (
  company_custom_field_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company(company_id) ON DELETE CASCADE,
  field_key VARCHAR(100) NOT NULL,
  field_label VARCHAR(150) NOT NULL,
  field_type VARCHAR(30) NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'boolean', 'textarea', 'select')),
  field_options TEXT[],
  is_required BOOLEAN DEFAULT false,
  is_visible BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP
);

-- Valores dos campos personalizados
CREATE TABLE company_custom_field_value (
  company_custom_field_value_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_custom_field_id UUID NOT NULL REFERENCES company_custom_field(company_custom_field_id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES company(company_id) ON DELETE CASCADE,
  field_value TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP
);




