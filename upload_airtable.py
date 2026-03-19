"""Upload dados-ajustes.js to Airtable table Ajustes."""
import re, json, time, requests

BASE_ID = "appC95CSdCeBrKQ83"
TABLE_ID = "tblDkBDYexZi3bY1E"
TOKEN = "pat0KFWb7Vc0aevY1.9511b6c89f912e5c581d17fbd06427e55ca13d5cd2cc0631b4a6d810152b463f"
URL = f"https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}"
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]

def parse_js_file(path):
    with open(path, "r", encoding="utf-8") as f:
        text = f.read()
    # Strip const declaration, get array content
    m = re.search(r"const\s+DADOS_AJUSTES\s*=\s*(\[.*\])\s*;?\s*$", text, re.DOTALL)
    if not m:
        raise ValueError("Could not find DADOS_AJUSTES array")
    arr_text = m.group(1)
    # Convert JS object syntax to JSON: add quotes around keys
    arr_text = re.sub(r"(\w+)\s*:", r'"\1":', arr_text)
    # Replace single quotes with double quotes
    arr_text = arr_text.replace("'", '"')
    # Remove trailing commas before ] or }
    arr_text = re.sub(r",\s*([}\]])", r"\1", arr_text)
    return json.loads(arr_text)

def map_record(item):
    fields = {
        "Produto": item["nome"],
        "Receita": item["receita"],
        "CMV Antes": item["cmvAntes"],
        "CMV Depois": item["cmvDepois"],
        "Economia": round(item["cmvAntes"] - item["cmvDepois"], 2),
        "Margem R$ Antes": item["mgAntes"],
        "Margem R$ Depois": item["mgDepois"],
        "Devolucao R$": item["devolucao"],
        "CMC Final Antes": item["cmcFinalAntes"],
        "CMC Final Depois": item["cmcFinalDepois"],
        "Vlr Estoque Antes": item["vlrEstoqueAntes"],
        "Vlr Estoque Depois": item["vlrEstoqueDepois"],
        "Preco Medio": item["precoMedio"],
        "Margem Pct Antes": item["pmgAntes"],
        "Margem Pct Depois": item["pmgDepois"],
        "Qtd Vendida": item["qtdVendida"],
        "Qtd Devolvida": item["qtdDevolvida"],
        "Saldo Antes": item["saldoAntes"],
        "Saldo Depois": item["saldoDepois"],
        "OPs Antes": item["opsAntes"],
        "OPs Depois": item["opsDepois"],
        "Dias Total": item["diasTotal"],
        "Dias Negativo": item["diasNegativo"],
        "Dias Excessivo": item["diasExcessivo"],
        "Dias OK": item["diasOk"],
        "Pior Saldo": item["piorSaldo"],
        "Maior Saldo": item["maiorSaldo"],
        "Dias CMC Alto": item["diasCmcAlto"],
        "CMC Mediana": item["cmcMediana"],
        "CMC Max": item["cmcMax"],
        "Dias Negativo Depois": item["diasNegativoDepois"],
        "Dias Excessivo Depois": item["diasExcessivoDepois"],
        "Dias OK Depois": item["diasOkDepois"],
    }
    # Quebra Pct
    if item["devolucao"] > 0:
        fields["Quebra Pct"] = round(item["qtdDevolvida"] / (item["qtdVendida"] + item["qtdDevolvida"]) * 100, 2)
    else:
        fields["Quebra Pct"] = 0
    # Monthly arrays
    for i, mes in enumerate(MESES):
        fields[f"CMC {mes} Antes"] = item["cmcMesAntes"][i]
        fields[f"CMC {mes} Depois"] = item["cmcMesDepois"][i]
        fields[f"Qtd {mes}"] = item["qtdMes"][i]
        fields[f"Rec {mes}"] = item["recMes"][i]
    return {"fields": fields}

def delete_all_records():
    print("=== Deleting existing records ===")
    total_deleted = 0
    while True:
        r = requests.get(URL, headers=HEADERS, params={"pageSize": 100, "fields[]": []})
        r.raise_for_status()
        data = r.json()
        records = data.get("records", [])
        if not records:
            break
        ids = [rec["id"] for rec in records]
        # Delete in batches of 10
        for i in range(0, len(ids), 10):
            batch = ids[i:i+10]
            params = "&".join(f"records[]={rid}" for rid in batch)
            dr = requests.delete(f"{URL}?{params}", headers=HEADERS)
            dr.raise_for_status()
            total_deleted += len(batch)
            print(f"  Deleted {total_deleted} records...")
            time.sleep(0.2)
    print(f"Total deleted: {total_deleted}")

def create_records(items):
    print(f"\n=== Creating {len(items)} records ===")
    total_created = 0
    for i in range(0, len(items), 10):
        batch = items[i:i+10]
        payload = {"records": [map_record(item) for item in batch]}
        r = requests.post(URL, headers=HEADERS, json=payload)
        if r.status_code != 200:
            print(f"  ERROR batch {i//10+1}: {r.status_code} {r.text[:300]}")
            r.raise_for_status()
        total_created += len(batch)
        print(f"  Created {total_created}/{len(items)} records")
        time.sleep(0.2)
    print(f"\nDone! Total created: {total_created}")

if __name__ == "__main__":
    data = parse_js_file(r"C:\Users\alex\Documents\ANALISE_MARGENS_PERFORMANCE_PRODUTO\dados-ajustes.js")
    print(f"Parsed {len(data)} products from JS file")
    delete_all_records()
    create_records(data)
