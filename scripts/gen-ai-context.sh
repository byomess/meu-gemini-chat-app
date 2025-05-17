#!/bin/bash

# Nome do arquivo de saída
OUTPUT_FILE="loox_master_context.md"
# Nome do script para mensagens de uso
SCRIPT_NAME="$(basename "$0")"

# --- Início das Verificações de Dependências ---
# Verificar se realpath está disponível
if ! command -v realpath &> /dev/null; then
    echo "Erro: O comando 'realpath' não foi encontrado. Por favor, instale-o." >&2
    echo "No macOS, tente: brew install coreutils (e use 'grealpath' ou adicione coreutils ao PATH)." >&2
    echo "No Debian/Ubuntu, tente: sudo apt install coreutils" >&2
    exit 1
fi

# Verificar se tree está disponível
if ! command -v tree &> /dev/null; then
    echo "Erro: O comando 'tree' não foi encontrado. Por favor, instale-o." >&2
    echo "No macOS, tente: brew install tree" >&2
    echo "No Debian/Ubuntu, tente: sudo apt install tree" >&2
    exit 1
fi
# --- Fim das Verificações de Dependências ---


# Arrays para armazenar os caminhos de inclusão e exclusão
include_paths=()
exclude_patterns_raw=()

declare -a exclude_items_abs_path
declare -a exclude_items_type

# --- Início do Parsing de Argumentos ---
OPTIND=1
while getopts ":i:I:" opt; do
  case $opt in
    i)
      include_paths+=("$OPTARG")
      ;;
    I)
      exclude_patterns_raw+=("$OPTARG")
      ;;
    \?)
      echo "Opção inválida: -$OPTARG" >&2
      echo "Uso: $SCRIPT_NAME [-i <caminho_include>]... [-I <caminho_exclude>]..." >&2
      exit 1
      ;;
    :)
      echo "Opção -$OPTARG requer um argumento." >&2
      echo "Uso: $SCRIPT_NAME [-i <caminho_include>]... [-I <caminho_exclude>]..." >&2
      exit 1
      ;;
  esac
done
shift $((OPTIND-1))

if [ "$#" -gt 0 ]; then
    echo "Argumentos inesperados: $@" >&2
    echo "Uso: $SCRIPT_NAME [-i <caminho_include>]... [-I <caminho_exclude>]..." >&2
    exit 1
fi
# --- Fim do Parsing de Argumentos ---

# Processar padrões de exclusão brutos
exclude_items_abs_path=()
exclude_items_type=()
for pattern_raw in "${exclude_patterns_raw[@]}"; do
    abs_pattern_norm=$(realpath -m "$pattern_raw")
    exclude_items_abs_path+=("$abs_pattern_norm")
    if [ -d "$pattern_raw" ]; then
        exclude_items_type+=("dir")
    else
        exclude_items_type+=("file")
    fi
done

# Limpa o arquivo de saída
> "$OUTPUT_FILE"

# --- Início da Adição de Contexto e Árvore de Arquivos ---
echo "Gerando contexto para IA em: $OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE" # Linha em branco

echo "**Contexto do Projeto Loox para a IA**" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "Abaixo, você tem à disposição informações sobre o projeto Loox para ajudá-lo a entender sua estrutura e código." >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "**Estrutura de Arquivos do Projeto**" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "A seguir, a árvore de arquivos do projeto Loox. Diretórios como \`node_modules\`, \`dist\`, \`.git\` e \`dev-dist\` foram omitidos para clareza:" >> "$OUTPUT_FILE"
echo "\`\`\`text" >> "$OUTPUT_FILE"
# Usar tree para gerar a estrutura, ignorando diretórios comuns
# -L 4: Limitar a profundidade para não ser excessivo
# -I: Padrão para ignorar
tree -L 4 -I "node_modules|dist|.git|dev-dist|public" . >> "$OUTPUT_FILE" # Adicionei 'public' aqui também
echo "\`\`\`" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "---" >> "$OUTPUT_FILE" # Separador horizontal
echo "" >> "$OUTPUT_FILE"

echo "**Conteúdo dos Arquivos Relevantes**" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "Abaixo está o conteúdo dos arquivos selecionados do projeto Loox que são relevantes para o contexto atual:" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
# --- Fim da Adição de Contexto e Árvore de Arquivos ---


if [ ${#exclude_items_abs_path[@]} -gt 0 ]; then
    echo "Aplicando exclusões específicas (-I):"
    for i in "${!exclude_items_abs_path[@]}"; do
        echo "  - Tipo: ${exclude_items_type[$i]}, Padrão (normalizado): ${exclude_items_abs_path[$i]} (Original: ${exclude_patterns_raw[$i]})"
    done
fi
echo "-----------------------------------------------------"


is_file_excluded() {
    local candidate_filepath="$1"
    local abs_candidate_filepath
    abs_candidate_filepath=$(realpath -m "$candidate_filepath")

    for i in "${!exclude_items_abs_path[@]}"; do
        local ex_abs_path="${exclude_items_abs_path[$i]}"
        local ex_type="${exclude_items_type[$i]}"

        if [[ "$ex_type" == "dir" ]]; then
            if [[ "$abs_candidate_filepath" == "$ex_abs_path/"* ]]; then
                return 0
            fi
             if [[ "$abs_candidate_filepath" == "$ex_abs_path" ]]; then
                return 0
             fi
        else
            if [[ "$abs_candidate_filepath" == "$ex_abs_path" ]]; then
                return 0
            fi
        fi
    done
    return 1
}

add_file_to_output_if_not_excluded() {
    local filepath="$1"

    if is_file_excluded "$filepath"; then
        echo "Excluindo (regra -I): $filepath"
        return
    fi

    local clean_filepath
    if [[ "$filepath" == /* ]]; then
        clean_filepath="$filepath"
    else
        if [[ "$filepath" == "." ]]; then clean_filepath="."; else clean_filepath="./${filepath#./}"; fi
    fi

    echo "Adicionando: $clean_filepath"

    local filename_part="${clean_filepath##*/}"
    local ext="${filename_part##*.}"

    if [[ "$ext" == "$filename_part" ]]; then
        if [[ "$filename_part" == "Makefile" ]]; then ext="makefile";
        elif [[ "$filename_part" == "Dockerfile" ]]; then ext="dockerfile";
        elif [[ "$filename_part" == ".gitignore" ]]; then ext="gitignore";
        elif [[ "$filename_part" == "README" ]]; then ext="md";
        elif [[ "$filename_part" == *"rc" && "$filename_part" == .* ]]; then
            ext="${filename_part#.}"; ext="${ext%rc}rc";
            if [[ "$filename_part" == ".eslintrc" ]]; then ext="js"; fi
            if [[ "$filename_part" == ".prettierrc" ]]; then ext="json"; fi
        else ext="txt"; fi
    elif [[ -z "$ext" ]]; then ext="txt"; fi

    case "$ext" in
        "tsx") ext="tsx" ;; "ts") ext="typescript" ;; "js") ext="javascript" ;;
        "jsx") ext="jsx" ;; "json") ext="json" ;; "jsonc") ext="json" ;;
        "html") ext="html" ;; "css") ext="css" ;; "md") ext="markdown" ;;
        "yaml"|"yml") ext="yaml" ;; "sh") ext="bash" ;;
    esac
    ext=$(echo "$ext" | tr '[:upper:]' '[:lower:]')

    # Escrever no arquivo de saída
    echo "$clean_filepath" >> "$OUTPUT_FILE" # Já vai estar no arquivo de saída
    echo "\`\`\`$ext" >> "$OUTPUT_FILE"
    cat "$filepath" >> "$OUTPUT_FILE"
    echo "\`\`\`" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
}


# Lógica principal:
if [ ${#include_paths[@]} -gt 0 ]; then
    echo "Modo de inclusão específica (-i) ativado."
    for path_spec in "${include_paths[@]}"; do
        normalized_path_spec="$path_spec"
        if [[ "$path_spec" != /* && "$path_spec" != ./* && "$path_spec" != "." ]]; then
            normalized_path_spec="./$path_spec"
        fi

        if [ -f "$normalized_path_spec" ]; then
            add_file_to_output_if_not_excluded "$normalized_path_spec"
        elif [ -d "$normalized_path_spec" ]; then
            echo "Processando arquivos do diretório (inclusão específica): $normalized_path_spec"
            find "$normalized_path_spec" \
                \( -path "*/node_modules" -o -path "*/dist" -o -path "*/.git" -o -path "*/.DS_Store" -o -path "*/dev-dist" \) -prune \
                -o -type f \
                -not \( \
                    -name "*.orig" \
                    -o -iname "*.png" -o -iname "*.svg" -o -iname "*.ico" \
                    -o -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.gif" \
                    -o -iname "*.woff" -o -iname "*.woff2" -o -iname "*.eot" \
                    -o -iname "*.ttf" -o -iname "*.otf" \
                    -o -name ".DS_Store" \
                \) \
                -print0 | while IFS= read -r -d $'\0' file_from_dir; do
                add_file_to_output_if_not_excluded "$file_from_dir"
            done
        else
            echo "AVISO: Caminho de inclusão (-i) não encontrado ou inválido: '$path_spec' (normalizado para '$normalized_path_spec')"
        fi
    done
else
    echo "Modo padrão: incluindo package.json e todo o conteúdo de src/."
    PACKAGE_JSON_PATH="./package.json"
    if [ -f "$PACKAGE_JSON_PATH" ]; then
        add_file_to_output_if_not_excluded "$PACKAGE_JSON_PATH"
    else
        echo "AVISO: $PACKAGE_JSON_PATH não encontrado."
    fi

    echo "-----------------------------------------------------"
    echo "Processando arquivos da pasta src/ (modo padrão)..."
    if [ -d "./src" ]; then
        find ./src \
            \( -path "*/node_modules" -o -path "*/dist" -o -path "*/.git" -o -path "*/.DS_Store" -o -path "*/dev-dist" \) -prune \
            -o -type f \
            -not \( \
                -name "*.orig" \
                -o -iname "*.png" -o -iname "*.svg" -o -iname "*.ico" \
                -o -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.gif" \
                -o -iname "*.woff" -o -iname "*.woff2" -o -iname "*.eot" \
                -o -iname "*.ttf" -o -iname "*.otf" \
                -o -name ".DS_Store" \
            \) \
            -print0 | while IFS= read -r -d $'\0' filepath_from_src; do
            add_file_to_output_if_not_excluded "$filepath_from_src"
        done
    else
        echo "AVISO: Diretório ./src não encontrado."
    fi
fi

echo "-----------------------------------------------------"
echo "Geração de contexto concluída! O arquivo está em: $OUTPUT_FILE"
echo "Use 'cat $OUTPUT_FILE | pbcopy' (macOS) ou 'cat $OUTPUT_FILE | xclip -selection clipboard' (Linux) para copiar."