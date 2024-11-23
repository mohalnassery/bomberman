import os
from pathlib import Path

def generate_project_documentation(output_file="project_documentation.md"):
    # Get the current directory
    current_dir = os.path.dirname(os.path.abspath(__file__))
    
    with open(output_file, 'w', encoding='utf-8') as f:
        # Write introduction and excluded files
        f.write("# Project Documentation\n\n")
        f.write("## Excluded Files\n\n")
        f.write("The following files are excluded from this documentation:\n")
        f.write("- `audit.md`\n")
        f.write("- `todo.md`\n")
        f.write("- `project_documentation.md`\n")
        f.write("- `documenter.py`\n\n")
        
        # First, write the tree structure
        f.write("## Project Structure\n\n")
        f.write("```\n")
        
        # Generate and write tree
        tree_content = generate_tree(current_dir)
        f.write(tree_content)
        f.write("```\n\n")
        
        f.write("# File Contents\n\n")
        
        # Write contents of each file
        for root, _, files in os.walk(current_dir):
            # Skip the .git directory
            if '.git' in root:
                continue
            
            for file in files:
                file_path = os.path.join(root, file)
                rel_path = os.path.relpath(file_path, current_dir)
                
                # Skip the output file itself and common binary/unwanted files
                if (file == os.path.basename(output_file) or
                    file.endswith(('.pyc', '.pyo', '.pyd', '.so', '.dll', '.exe', 
                                 '.git', '.idea', '__pycache__', 'todo2.md', '.css', '.json','audit.md', 'todo.md','project_documentation.md','documenter.py'))):
                    continue
                
                try:
                    with open(file_path, 'r', encoding='utf-8') as source_file:
                        content = source_file.read()
                        f.write(f"\n## {rel_path}\n\n")
                        # Determine the language for syntax highlighting
                        extension = os.path.splitext(file)[1][1:]  # Remove the dot
                        if extension in ['py', 'js', 'java', 'cpp', 'c', 'html', 'css', 'md']:
                            lang = extension
                        else:
                            lang = ''
                        f.write(f"```{lang}\n")
                        f.write(content)
                        f.write("\n```\n\n")
                except (UnicodeDecodeError, IOError):
                    f.write(f"\n## {rel_path}\n\n")
                    f.write("```\n[Binary or unreadable file]\n```\n\n")

def generate_tree(start_path):
    tree_str = ""
    for root, dirs, files in os.walk(start_path):
        # Skip hidden directories and files
        dirs[:] = [d for d in dirs if not d.startswith('.')]
        files = [f for f in files if not f.startswith('.')]
        
        level = root.replace(start_path, '').count(os.sep)
        indent = '│   ' * (level - 1) + '├── ' if level > 0 else ''
        rel_path = os.path.relpath(root, start_path)
        
        # Add directory name
        if rel_path != '.':
            tree_str += f"{indent}{os.path.basename(root)}/\n"
        
        # Add files
        for i, file in enumerate(files):
            if file == os.path.basename(__file__):
                continue
                
            # Use └── for last file in a directory, ├── for others
            if i == len(files) - 1:
                file_indent = '│   ' * (level - 1) + '└── ' if level > 0 else ''
            else:
                file_indent = indent
                
            tree_str += f"{file_indent}{file}\n"
    
    return tree_str

if __name__ == "__main__":
    generate_project_documentation()