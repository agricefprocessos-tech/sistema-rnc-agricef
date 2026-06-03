#!/usr/bin/env python3
"""
patch_config.py — Injeta os IDs reais no Code.gs após o setup_jira.py
======================================================================
Lê o jira_mapeamento_ids.json gerado pelo setup_jira.py e substitui
automaticamente todos os placeholders no Code.gs:

  - customfield_XXXXX  → IDs reais dos custom fields
  - JIRA_ISSUE_TYPE    → ID do Issue Type "Não Conformidade"
  - ID_PASTA_RAIZ_DRIVE → (solicitado interativamente se não informado)
  - ID_TEMPLATE_DOC    → (solicitado interativamente se não informado)

Uso:
  python patch_config.py

  # Com IDs do Drive passados via variáveis de ambiente:
  DRIVE_PASTA_ID=1BxiMVs... DRIVE_TEMPLATE_ID=1aMVt9z... python patch_config.py
"""

import json
import os
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path

SCRIPT_DIR   = Path(__file__).parent
MAPEAMENTO   = SCRIPT_DIR / "jira_mapeamento_ids.json"
CODE_GS      = SCRIPT_DIR / "Code.gs"
BACKUP_SUFX  = f".backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

# Mapa entre chaves do JSON e constantes no CONFIG do Code.gs
CAMPO_PARA_CONFIG = {
    "ORIGEM":    "ORIGEM",
    "SETOR":     "SETOR",
    "QTD_LOTE":  "QTD_LOTE",
    "QTD_DESVIO":"QTD_DESVIO",
    "COD_ITEM":  "COD_ITEM",
    "LINK_PDF":  "LINK_PDF",
    "CAUSA_RAIZ":"CAUSA_RAIZ",
    "DISPOSICAO":"DISPOSICAO",
}


def carregar_mapeamento() -> dict:
    if not MAPEAMENTO.exists():
        print(f"❌ Arquivo '{MAPEAMENTO.name}' não encontrado.")
        print("   Execute primeiro: python setup_jira.py")
        sys.exit(1)
    with open(MAPEAMENTO, encoding="utf-8") as f:
        return json.load(f)


def solicitar_id(nome: str, env_var: str, exemplo: str) -> str:
    valor = os.environ.get(env_var, "").strip()
    if valor:
        print(f"   ✓ {nome}: {valor}  (lido de {env_var})")
        return valor
    print(f"\n📌 {nome}")
    print(f"   Como obter: abra o item no Google Drive/Docs e copie o ID da URL.")
    print(f"   Exemplo de URL: .../d/{exemplo}/edit")
    valor = input(f"   Cole o ID aqui: ").strip()
    if not valor:
        print("   ❌ ID não pode ser vazio. Abortando.")
        sys.exit(1)
    return valor


def fazer_backup(path: Path) -> Path:
    backup = path.with_suffix(path.suffix + BACKUP_SUFX)
    shutil.copy2(path, backup)
    return backup


def aplicar_substituicoes(codigo: str, mapeamento: dict, pasta_id: str, template_id: str) -> tuple[str, list]:
    """Retorna (código_atualizado, lista_de_substituicoes_realizadas)."""
    substituicoes = []
    campos = mapeamento.get("campos", {})
    issue_type_id = mapeamento.get("issue_type_id", "")

    # 1. Custom fields — substitui o valor string de cada entrada no CONFIG.CF
    for chave_config, chave_json in CAMPO_PARA_CONFIG.items():
        if chave_json not in campos:
            print(f"   ⚠ Campo '{chave_json}' não encontrado no mapeamento. Pulando.")
            continue
        field_id = campos[chave_json]["id"]
        # Padrão: ORIGEM: "customfield_XXXXX",  ou  ORIGEM:   "customfield_XXXXX",
        padrao = rf'({re.escape(chave_config)}:\s*)"(customfield_[^"]+)"'
        novo, n = re.subn(padrao, rf'\1"{field_id}"', codigo)
        if n:
            substituicoes.append(f"  CF.{chave_config:<12} → {field_id}")
            codigo = novo
        else:
            print(f"   ⚠ Padrão CF.{chave_config} não encontrado no Code.gs")

    # 2. Issue Type ID
    if issue_type_id:
        padrao = r'(JIRA_ISSUE_TYPE:\s*)"[^"]+"'
        novo, n = re.subn(padrao, rf'\1"{issue_type_id}"', codigo)
        if n:
            substituicoes.append(f"  JIRA_ISSUE_TYPE  → {issue_type_id}")
            codigo = novo

    # 3. Pasta raiz Drive
    padrao = r'(PASTA_RAIZ_ID:\s*)"ID_PASTA_RAIZ_DRIVE"'
    novo, n = re.subn(padrao, rf'\1"{pasta_id}"', codigo)
    if n:
        substituicoes.append(f"  PASTA_RAIZ_ID    → {pasta_id}")
        codigo = novo
    else:
        # Já pode ter um ID diferente — não reaplica
        if "ID_PASTA_RAIZ_DRIVE" not in codigo:
            substituicoes.append(f"  PASTA_RAIZ_ID    → (placeholder não encontrado — já configurado?)")

    # 4. Template Doc
    padrao = r'(TEMPLATE_DOC_ID:\s*)"ID_TEMPLATE_DOC"'
    novo, n = re.subn(padrao, rf'\1"{template_id}"', codigo)
    if n:
        substituicoes.append(f"  TEMPLATE_DOC_ID  → {template_id}")
        codigo = novo
    else:
        if "ID_TEMPLATE_DOC" not in codigo:
            substituicoes.append(f"  TEMPLATE_DOC_ID  → (placeholder não encontrado — já configurado?)")

    return codigo, substituicoes


def verificar_placeholders_restantes(codigo: str):
    """Avisa se ainda restam placeholders não substituídos."""
    pendentes = []
    if "customfield_XXXXX" in codigo or re.search(r'customfield_101\d\d', codigo):
        pendentes.append("customfield_XXXXX (campos CF ainda com placeholder)")
    if "ID_PASTA_RAIZ_DRIVE" in codigo:
        pendentes.append("ID_PASTA_RAIZ_DRIVE")
    if "ID_TEMPLATE_DOC" in codigo:
        pendentes.append("ID_TEMPLATE_DOC")
    return pendentes


def main():
    print("=" * 58)
    print("  PATCH CONFIG — Sistema RNC Agricef")
    print("=" * 58)

    if not CODE_GS.exists():
        print(f"❌ '{CODE_GS.name}' não encontrado em {SCRIPT_DIR}")
        sys.exit(1)

    # Carrega mapeamento
    mapeamento = carregar_mapeamento()
    print(f"✓ Mapeamento carregado: {len(mapeamento.get('campos', {}))} campos")

    # IDs do Drive
    print("\n🗂  IDs do Google Drive (necessários para o Code.gs):")
    pasta_id    = solicitar_id(
        "ID da pasta 'Repositório RNC' no Google Drive",
        "DRIVE_PASTA_ID",
        "1BxiMVs0uV8xxxxxxxxxxxxxxxxxxxxxxxxxxx"
    )
    template_id = solicitar_id(
        "ID do template 'TEMPLATE_RNC_AGRICEF' no Google Docs",
        "DRIVE_TEMPLATE_ID",
        "1aMVt9zxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    )

    # Lê código
    codigo_original = CODE_GS.read_text(encoding="utf-8")

    # Backup
    backup_path = fazer_backup(CODE_GS)
    print(f"\n💾 Backup criado: {backup_path.name}")

    # Aplica substituições
    print("\n🔧 Aplicando substituições...")
    codigo_novo, substituicoes = aplicar_substituicoes(
        codigo_original, mapeamento, pasta_id, template_id
    )

    if substituicoes:
        for s in substituicoes:
            print(s)
    else:
        print("   ⚠ Nenhuma substituição realizada. Verifique o Code.gs.")

    # Salva
    CODE_GS.write_text(codigo_novo, encoding="utf-8")
    print(f"\n✅ Code.gs atualizado com sucesso.")

    # Verifica placeholders restantes
    pendentes = verificar_placeholders_restantes(codigo_novo)
    if pendentes:
        print("\n⚠  Ainda existem placeholders não preenchidos:")
        for p in pendentes:
            print(f"   • {p}")
        print("   Verifique manualmente o Code.gs antes do deploy.")
    else:
        print("✅ Nenhum placeholder pendente. Code.gs pronto para deploy.")

    print("\n▶  Próximo passo:")
    print("   1. Edite CONFIG.RES_AUTORIZADOS com os REs reais dos operadores")
    print("   2. Configure PropertiesService no GAS (JIRA_URL, JIRA_EMAIL, JIRA_TOKEN)")
    print("   3. Execute: clasp push  (ou copie manualmente em script.google.com)")
    print("   Veja o README.md para o guia completo.\n")


if __name__ == "__main__":
    main()
