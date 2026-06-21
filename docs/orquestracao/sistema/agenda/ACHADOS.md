# sistema/agenda — ACHADOS (destilado da Rodada 7 · cadeia-de-oferta)

> Etapa TEMPO/AGENDA. Fonte: IA-TEMPO/IA-BANCO · DECISION-0117 D / 0132 · Constituição Art. II.

## SSOT
- Tabela viva = **`availability`** (⚠️ NÃO `unified_availability` — esse nome no plano/código antigo é stale).
- CHECK `owner_type` = **6 tipos** incl. `service_offering` (aplicado). Owner canônico da oferta-tempo = **`service_offering`** (fonte = **DECISION-0117 D**, NÃO 0132). `purpose_concept_id` (0132) = finalidade da agenda pessoal, vivo.
- Estado vivo: **48 linhas, TODAS `owner_type='user'`** (zero `service_offering` → oferta-tempo nunca usada).

## Achados / gaps
1. **`detect_availability_conflicts()` = STUB** (`BEGIN RETURN; END;`) → alerta de conflito MORTO. Conformidade Art. II correta (conflito = fato→alerta→humano, não bloqueia, não auto-resolve), execução inerte.
2. **GAP cross-oferta:** "prestador ocupado" NÃO é checado através das ofertas do mesmo `provider_actor_id` (fotógrafo em 2 casamentos no mesmo horário). O link offering→provider existe na policy de autoridade, mas nenhuma query de conflito usa. Desenhar rollup por provider, reativar o detector como FATO→ALERTA→HUMANO, **proibido auto-resolver**.
3. Writes de availability/booking passam por `canRepresentActor(owner)` — forte; manter.
4. "Oferta sem tempo não é oferta real": discovery deve INTERSECTAR `service_offerings × availability(owner='service_offering')` read-only; oferta sem availability = filtrada.
