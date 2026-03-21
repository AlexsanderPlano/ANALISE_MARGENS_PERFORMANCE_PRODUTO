.PHONY: install lint check build clean

# Instalar dependências
install:
	pip install -r requirements.txt
	pip install flake8

# Lint dos scripts Python
lint:
	flake8 --max-line-length=120 --ignore=E501,W503,E302,E303,W291,W293 *.py

# Validar sintaxe Python (sem executar)
check:
	python -m py_compile gerar_rentabilidade.py
	python -m py_compile gerar_dados_ajustes.py
	python -m py_compile gerar_stats.py
	python -m py_compile upload_airtable.py
	python -m py_compile reimportar_movimentos.py
	@echo "Todos os scripts compilam OK"

# Validar sintaxe dos JS de dados
check-js:
	node --check dados-produtos.js || true
	node --check dados-ajustes.js || true
	node --check dados-lista.js || true
	node --check painel-data.js || true
	node --check inspetor.js || true
	node --check mapa-ui.js || true
	@echo "Verificação JS concluída"

# Pipeline completa local
build: check lint
	@echo "Pipeline OK"

# Limpar artefatos
clean:
	find . -name '__pycache__' -type d -exec rm -rf {} + 2>/dev/null || true
	find . -name '*.pyc' -delete 2>/dev/null || true
