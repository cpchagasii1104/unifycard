-- 20260708130000: complemento — Renault Duster Oroch (picape/caminhonete) que faltou no CSV
-- original. Mesmo trilho governado (identidade em cascata + ficha tecnica). Idempotente.
BEGIN;
SELECT set_config('app.concept_governance','true',true);

-- Renault ja existe como marca. Modelo Duster Oroch (concept=caminhonete):
INSERT INTO vehicle_models (make_id, concept_id, slug, name)
SELECT mk.id,c.concept_id,v.mslug,v.mname FROM (VALUES
  ('renault','duster-oroch','Duster Oroch')
) AS v(makeslug,mslug,mname)
JOIN vehicle_makes mk ON mk.slug=v.makeslug
JOIN concepts c ON c.slug='caminhonete'
WHERE NOT EXISTS (SELECT 1 FROM vehicle_models m WHERE m.make_id=mk.id AND m.concept_id=c.concept_id AND m.slug=v.mslug);

INSERT INTO vehicle_model_years (model_id, year)
SELECT m.id,v.year FROM (VALUES
  ('renault','duster-oroch',2015),
  ('renault','duster-oroch',2016),
  ('renault','duster-oroch',2017),
  ('renault','duster-oroch',2018),
  ('renault','duster-oroch',2019),
  ('renault','duster-oroch',2020),
  ('renault','duster-oroch',2021),
  ('renault','duster-oroch',2022),
  ('renault','duster-oroch',2023),
  ('renault','duster-oroch',2024),
  ('renault','duster-oroch',2025),
  ('renault','duster-oroch',2026)
) AS v(makeslug,mslug,year)
JOIN vehicle_makes mk ON mk.slug=v.makeslug
JOIN concepts c ON c.slug='caminhonete'
JOIN vehicle_models m ON m.make_id=mk.id AND m.concept_id=c.concept_id AND m.slug=v.mslug
ON CONFLICT (model_id,year) DO NOTHING;

INSERT INTO vehicle_model_specs (model_id,year,version,motor,cilindrada_cc,potencia_cv,torque_kgfm,combustivel,tracao,cambio,num_portas,capacidade_carga_kg,peso_kg,comprimento_cm,largura_cm,altura_cm,entre_eixos_cm,pneus,freios_diant,freios_tras,suspensao_diant,suspensao_tras,direcao,tanque_litros,cacamba_litros)
SELECT m.id,v.year,v.version,v.motor,v.cilindrada_cc,v.potencia_cv,v.torque_kgfm,v.combustivel,v.tracao,v.cambio,v.num_portas,v.capacidade_carga_kg,v.peso_kg,v.comprimento_cm,v.largura_cm,v.altura_cm,v.entre_eixos_cm,v.pneus,v.freios_diant,v.freios_tras,v.suspensao_diant,v.suspensao_tras,v.direcao,v.tanque_litros,v.cacamba_litros
FROM (VALUES
  ('renault','duster-oroch',2015,'1.6 16V Hi-Flex','1.6 16V Hi-Flex',1598,106,15.5,'Flex','Dianteira','Manual 5M',4,650,1300,469,182,173,283,'215/65R16','Disco ventilado','Tambor','McPherson','Eixo rígido','Hidráulica',50,683),
  ('renault','duster-oroch',2015,'2.0 16V Hi-Flex','2.0 16V Hi-Flex',1997,143,19.5,'Flex','Dianteira','Manual 6M',4,650,1350,469,182,173,283,'215/65R16','Disco ventilado','Tambor','McPherson','Eixo rígido','Hidráulica',50,683),
  ('renault','duster-oroch',2016,'1.6 16V Hi-Flex','1.6 16V Hi-Flex',1598,106,15.5,'Flex','Dianteira','Manual 5M',4,650,1300,469,182,173,283,'215/65R16','Disco ventilado','Tambor','McPherson','Eixo rígido','Hidráulica',50,683),
  ('renault','duster-oroch',2016,'2.0 16V Hi-Flex','2.0 16V Hi-Flex',1997,143,19.5,'Flex','Dianteira','Manual 6M',4,650,1350,469,182,173,283,'215/65R16','Disco ventilado','Tambor','McPherson','Eixo rígido','Hidráulica',50,683),
  ('renault','duster-oroch',2017,'1.6 16V Hi-Flex','1.6 16V Hi-Flex',1598,106,15.5,'Flex','Dianteira','Manual 5M',4,650,1300,469,182,173,283,'215/65R16','Disco ventilado','Tambor','McPherson','Eixo rígido','Hidráulica',50,683),
  ('renault','duster-oroch',2017,'2.0 16V Hi-Flex','2.0 16V Hi-Flex',1997,143,19.5,'Flex','Dianteira','Manual 6M',4,650,1350,469,182,173,283,'215/65R16','Disco ventilado','Tambor','McPherson','Eixo rígido','Hidráulica',50,683),
  ('renault','duster-oroch',2018,'1.6 16V Hi-Flex','1.6 16V Hi-Flex',1598,106,15.5,'Flex','Dianteira','Manual 5M',4,650,1300,469,182,173,283,'215/65R16','Disco ventilado','Tambor','McPherson','Eixo rígido','Hidráulica',50,683),
  ('renault','duster-oroch',2018,'2.0 16V Hi-Flex','2.0 16V Hi-Flex',1997,143,19.5,'Flex','Dianteira','Manual 6M',4,650,1350,469,182,173,283,'215/65R16','Disco ventilado','Tambor','McPherson','Eixo rígido','Hidráulica',50,683),
  ('renault','duster-oroch',2019,'1.6 16V Hi-Flex','1.6 16V Hi-Flex',1598,106,15.5,'Flex','Dianteira','Manual 5M',4,650,1300,469,182,173,283,'215/65R16','Disco ventilado','Tambor','McPherson','Eixo rígido','Hidráulica',50,683),
  ('renault','duster-oroch',2019,'2.0 16V Hi-Flex','2.0 16V Hi-Flex',1997,143,19.5,'Flex','Dianteira','Manual 6M',4,650,1350,469,182,173,283,'215/65R16','Disco ventilado','Tambor','McPherson','Eixo rígido','Hidráulica',50,683),
  ('renault','duster-oroch',2020,'1.6 SCe Flex','1.6 SCe Flex',1598,120,16.2,'Flex','Dianteira','Manual 5M',4,650,1320,469,182,173,283,'215/65R16','Disco ventilado','Tambor','McPherson','Eixo rígido','Hidráulica',50,683),
  ('renault','duster-oroch',2020,'2.0 16V Hi-Flex','2.0 16V Hi-Flex',1997,143,19.5,'Flex','Dianteira','Manual 6M',4,650,1350,469,182,173,283,'215/65R16','Disco ventilado','Tambor','McPherson','Eixo rígido','Hidráulica',50,683),
  ('renault','duster-oroch',2021,'1.6 SCe Flex','1.6 SCe Flex',1598,120,16.2,'Flex','Dianteira','Manual 5M',4,650,1320,469,182,173,283,'215/65R16','Disco ventilado','Tambor','McPherson','Eixo rígido','Hidráulica',50,683),
  ('renault','duster-oroch',2021,'2.0 16V Hi-Flex','2.0 16V Hi-Flex',1997,143,19.5,'Flex','Dianteira','Manual 6M',4,650,1350,469,182,173,283,'215/65R16','Disco ventilado','Tambor','McPherson','Eixo rígido','Hidráulica',50,683),
  ('renault','duster-oroch',2022,'1.3 Turbo TCe Flex','1.3 Turbo TCe Flex',1332,170,27,'Flex','Dianteira','CVT 8 marchas',4,650,1380,469,182,173,283,'215/65R16','Disco ventilado','Tambor','McPherson','Eixo rígido','Elétrica',50,683),
  ('renault','duster-oroch',2023,'1.3 Turbo TCe Flex','1.3 Turbo TCe Flex',1332,170,27,'Flex','Dianteira','CVT 8 marchas',4,650,1380,469,182,173,283,'215/65R16','Disco ventilado','Tambor','McPherson','Eixo rígido','Elétrica',50,683),
  ('renault','duster-oroch',2024,'1.3 Turbo TCe Flex','1.3 Turbo TCe Flex',1332,170,27,'Flex','Dianteira','CVT 8 marchas',4,650,1380,469,182,173,283,'215/65R16','Disco ventilado','Tambor','McPherson','Eixo rígido','Elétrica',50,683),
  ('renault','duster-oroch',2025,'1.3 Turbo TCe Flex','1.3 Turbo TCe Flex',1332,170,27,'Flex','Dianteira','CVT 8 marchas',4,650,1380,469,182,173,283,'215/65R16','Disco ventilado','Tambor','McPherson','Eixo rígido','Elétrica',50,683),
  ('renault','duster-oroch',2026,'1.3 Turbo TCe Flex','1.3 Turbo TCe Flex',1332,170,27,'Flex','Dianteira','CVT 8 marchas',4,650,1380,469,182,173,283,'215/65R16','Disco ventilado','Tambor','McPherson','Eixo rígido','Elétrica',50,683)
) AS v(makeslug,mslug,year,version,motor,cilindrada_cc,potencia_cv,torque_kgfm,combustivel,tracao,cambio,num_portas,capacidade_carga_kg,peso_kg,comprimento_cm,largura_cm,altura_cm,entre_eixos_cm,pneus,freios_diant,freios_tras,suspensao_diant,suspensao_tras,direcao,tanque_litros,cacamba_litros)
JOIN vehicle_makes mk ON mk.slug=v.makeslug
JOIN concepts c ON c.slug='caminhonete'
JOIN vehicle_models m ON m.make_id=mk.id AND m.concept_id=c.concept_id AND m.slug=v.mslug
ON CONFLICT (model_id,year,version) DO NOTHING;

COMMIT;
