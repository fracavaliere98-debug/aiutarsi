import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

const auditDir = path.join(process.cwd(), 'audit');
if (!fs.existsSync(auditDir)) {
    fs.mkdirSync(auditDir);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function generateRLSAudit() {
    console.log('--- Generating RLS Audit ---');
    try {
        const { data, error } = await supabase.rpc('get_rls_summary');
        if (error) throw error;
        
        let report = '# RLS Security Audit\n\n';
        report += '| Table | RLS | Policy | Action | Roles | Logic |\n';
        report += '|-------|-----|--------|--------|-------|-------|\n';

        (data as any[]).forEach((row: any) => {
            const rlsIcon = row.rls_enabled ? '✅' : '❌';
            report += `| ${row.tablename} | ${rlsIcon} | ${row.policyname || '*NONE*'} | ${row.cmd || '-'} | ${row.roles?.join(', ') || '-'} | \`${row.using_expr || row.check_expr || '-'}\` |\n`;
        });
        
        fs.writeFileSync(path.join(auditDir, 'rls_status.md'), report);
        return report;
    } catch (err) {
        console.error('Error generating RLS Audit (RPC might be missing or permission denied):', err);
        return 'Error generating RLS Audit. Make sure get_rls_summary() is installed.';
    }
}

async function generateAPIDocs() {
    console.log('--- Generating API Docs ---');
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
            headers: { 'apikey': SUPABASE_KEY }
        });
        const openApi = await response.json();
        
        let md = `# API Documentation (OpenAPI)\n\nSummarized from Supabase PostgREST.\n\n`;
        md += `**External URL:** ${SUPABASE_URL}/rest/v1/\n\n`;
        
        const paths = openApi.paths || {};
        Object.keys(paths).sort().forEach(path => {
            const methods = paths[path];
            md += `### ${path}\n`;
            Object.entries(methods as any).forEach(([method, details]) => {
                md += `- **${method.toUpperCase()}**: ${(details as any).summary || (details as any).description || 'No summary'}\n`;
            });
            md += '\n';
        });
        
        fs.writeFileSync(path.join(auditDir, 'api_docs.md'), md);
        return md;
    } catch (err) {
        console.error('Error generating API Docs:', err);
        return 'Error generating API Docs';
    }
}

async function generateDependencyGraph() {
    console.log('--- Generating Dependency Graph ---');
    const dirs = ['app', 'components', 'services', 'context', 'hooks', 'utils'];
    
    let nodes = new Set<string>();
    let edges: string[] = [];

    function scanDir(dirName: string) {
        const dirPath = path.join(process.cwd(), dirName);
        if (!fs.existsSync(dirPath)) return;
        
        const files = fs.readdirSync(dirPath, { recursive: true });
        
        for (const file of files) {
            const filePath = path.join(dirPath, file as string);
            if (fs.statSync(filePath).isDirectory()) continue;
            if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) continue;

            const content = fs.readFileSync(filePath, 'utf-8');
            const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
            nodes.add(relativePath);
            
            const importRegex = /from ['"](.*)['"]/g;
            let match;
            while ((match = importRegex.exec(content)) !== null) {
                const importPath = match[1];
                if (importPath.startsWith('.')) {
                    // Internal - try to resolve or just use basename for simplicity in graph
                    const targetBase = path.basename(importPath);
                    edges.push(`    "${relativePath}" --> "${targetBase}"`);
                } else if (!importPath.startsWith('react') && !importPath.startsWith('expo')) {
                   // External libraries (limited to name)
                   const libName = importPath.split('/')[0];
                   edges.push(`    "${relativePath}" -.-> "${libName}"`);
                }
            }
        }
    }

    dirs.forEach(scanDir);

    let mermaid = 'graph TD\n' + Array.from(new Set(edges)).join('\n');
    const report = `# Dependency Graph\n\n\`\`\`mermaid\n${mermaid}\n\`\`\`\n`;
    fs.writeFileSync(path.join(auditDir, 'dependencies.md'), report);
    return report;
}

async function mapRoutes() {
    console.log('--- Mapping Routes & Guards ---');
    const appDir = path.join(process.cwd(), 'app');
    let routes = '# UI/UX Routes & Guards\n\n';
    routes += '| Route Path | Layout/Guard | Type |\n';
    routes += '|------------|--------------|------|\n';

    function walk(dir: string) {
        const files = fs.readdirSync(dir);
        files.forEach(file => {
            const fullPath = path.join(dir, file);
            const relative = path.relative(appDir, fullPath).replace(/\\/g, '/');
            
            if (fs.statSync(fullPath).isDirectory()) {
                if (file.startsWith('(')) {
                   routes += `| /${file} | Layout Group | Group |\n`;
                }
                walk(fullPath);
            } else if (file.endsWith('.tsx') && !file.startsWith('_')) {
                const routeName = '/' + relative.replace('.tsx', '').replace('index', '');
                routes += `| ${routeName} | Standard | Page |\n`;
            }
        });
    }

    if (fs.existsSync(appDir)) walk(appDir);
    
    fs.writeFileSync(path.join(auditDir, 'routes.md'), routes);
    return routes;
}

async function scanEdgeFunctions() {
    console.log('--- Scanning Edge Functions ---');
    const functionsDir = path.join(process.cwd(), 'supabase', 'functions');
    let report = '# Edge Functions & Logic Flow\n\n';
    report += '| Function Name | Trigger (Inferred) | External APIs |\n';
    report += '|---------------|-------------------|---------------|\n';

    if (fs.existsSync(functionsDir)) {
        const folders = fs.readdirSync(functionsDir);
        for (const folder of folders) {
            const indexPath = path.join(functionsDir, folder, 'index.ts');
            if (fs.existsSync(indexPath)) {
                const content = fs.readFileSync(indexPath, 'utf-8');
                
                // Infer trigger from comments or payload access
                let trigger = 'HTTP Request';
                if (content.includes('Webhook payload')) trigger = 'DB Webhook';
                if (content.includes('auth.uid()')) trigger += ' (Auth Context)';
                
                // Detect external APIs
                const apiMatches = content.match(/https?:\/\/[a-zA-Z0-9.\-_/]+/g) || [];
                const apis = Array.from(new Set(apiMatches.filter(url => 
                    !url.includes('supabase.co') && 
                    !url.includes('deno.land') && 
                    !url.includes('esm.sh')
                )));
                
                report += `| ${folder} | ${trigger} | ${apis.join(', ') || 'None'} |\n`;
            }
        }
    } else {
        report += '| No functions found | - | - |\n';
    }
    
    fs.writeFileSync(path.join(auditDir, 'logic_flow.md'), report);
    return report;
}

async function main() {
    console.log('🚀 Starting Master Audit Generation...');
    
    const rls = await generateRLSAudit();
    const api = await generateAPIDocs();
    const deps = await generateDependencyGraph();
    const routes = await mapRoutes();
    const flows = await scanEdgeFunctions();
    
    let master = `# MASTER AUDIT REPORT\n\n`;
    master += `*Generated on: ${new Date().toLocaleString()}*\n\n`;
    
    master += `## 1. Data Schema & RLS\n${rls}\n\n`;
    master += `--- \n\n`;
    
    master += `## 2. UI/UX Routes & Guards\n${routes}\n\n`;
    master += `--- \n\n`;
    
    master += `## 3. Logic Flow & Edge Functions\n${flows}\n\n`;
    master += `--- \n\n`;
    
    master += `## 4. API Documentation\n> [Full Docs Here](./api_docs.md)\n\n${api.slice(0, 1000)}...\n\n`;
    master += `--- \n\n`;
    
    master += `## 5. Dependency Graph\n${deps}\n\n`;
    
    master += `## 6. Audit Logs Schema\n`;
    master += `Table: \`admin_audit_logs\` (Immutable)\n`;
    master += `| Action | Description |\n`;
    master += `|--------|-------------|\n`;
    master += `| WARN | Warning sent to user |\n`;
    master += `| BAN | User banned |\n`;
    master += `| HIDE | Content removed |\n`;
    master += `| DISMISS | Report archived |\n`;

    fs.writeFileSync(path.join(auditDir, 'MASTER_REPORT.md'), master);
    console.log('✅ Audit complete! See audit/MASTER_REPORT.md');
}

main();
