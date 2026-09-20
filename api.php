<?php
// Pacific Bluffs - API PHP (sin Node.js)
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$root = __DIR__; // raiz del proyecto
$dbPath = $root . '/data/db.json';
$sessionsPath = $root . '/data/sessions.json';

function respond($data, $status = 200) {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function now_iso() { return gmdate('c'); }
function uuidv4() {
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}
function read_json_file($path, $fallback = []) {
    if (!file_exists($path)) return $fallback;
    $raw = file_get_contents($path);
    $data = json_decode($raw, true);
    return is_array($data) ? $data : $fallback;
}
function write_json_file($path, $data) {
    $dir = dirname($path);
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    $tmp = $path . '.tmp';
    file_put_contents($tmp, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);
    rename($tmp, $path);
}
function db_read() {
    global $dbPath;
    $db = read_json_file($dbPath, []);
    if (!isset($db['users'])) $db['users'] = [];
    foreach ($db['users'] as &$u) {
        if (!array_key_exists('email', $u)) $u['email'] = '';
        if (!array_key_exists('active', $u)) $u['active'] = true;
    }
    return $db;
}
function db_write($db) { global $dbPath; write_json_file($dbPath, $db); }
function body_json() {
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}
function bearer_token() {
    $h = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (stripos($h, 'Bearer ') === 0) return trim(substr($h, 7));
    if (function_exists('getallheaders')) {
        $headers = getallheaders();
        foreach ($headers as $k => $v) if (strtolower($k) === 'authorization' && stripos($v, 'Bearer ') === 0) return trim(substr($v, 7));
    }
    return '';
}
function sessions_read() { global $sessionsPath; return read_json_file($sessionsPath, []); }
function sessions_write($s) { global $sessionsPath; write_json_file($sessionsPath, $s); }
function without_secrets($u) {
    if (!$u) return null;
    unset($u['passwordHash'], $u['salt']);
    return $u;
}
function auth_user($db) {
    $token = bearer_token();
    if (!$token) return null;
    $sessions = sessions_read();
    $session = $sessions[$token] ?? null;
    if (!$session || empty($session['userId'])) return null;
    foreach ($db['users'] as $u) if (($u['id'] ?? '') === $session['userId']) return ['user'=>$u, 'token'=>$token];
    return null;
}
function can_manage($u) { return $u && in_array($u['role'] ?? '', ['jefe','encargado'], true); }
function can_manage_users($u) { return $u && ($u['role'] ?? '') === 'jefe'; }
function clean_user($b) {
    return [
        'username' => substr(trim((string)($b['username'] ?? '')), 0, 50),
        'name' => substr(trim((string)($b['name'] ?? '')), 0, 80),
        'email' => substr(trim((string)($b['email'] ?? '')), 0, 120),
        'role' => trim((string)($b['role'] ?? '')),
        'active' => ($b['active'] ?? false) === true || ($b['active'] ?? '') === 'true' || ($b['active'] ?? '') === 'on'
    ];
}
function valid_role($r) { return in_array($r, ['jefe','encargado','empleado'], true); }
function password_hash_pb($password, $salt) { return hash('sha256', $salt . ':' . $password); }
function next_order_code($db) {
    $max = 1000;
    foreach (($db['orders'] ?? []) as $o) if (preg_match('/PB-(\d+)/', (string)($o['code'] ?? ''), $m)) $max = max($max, (int)$m[1]);
    return 'PB-' . ($max + 1);
}
function upsert(&$collection, $item) {
    if (empty($item['id'])) $item['id'] = uuidv4();
    foreach ($collection as $i => $existing) if (($existing['id'] ?? '') === $item['id']) { $collection[$i] = array_merge($existing, $item); return $collection[$i]; }
    $collection[] = $item; return $item;
}
function sanitize_public($db) {
    $anns = array_values(array_filter($db['announcements'] ?? [], fn($x) => !empty($x['visible'])));
    $menu = array_values(array_filter($db['menuItems'] ?? [], fn($x) => !empty($x['available'])));
    return ['business'=>$db['business'] ?? [], 'announcements'=>$anns, 'menuItems'=>$menu];
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$path = preg_replace('#^/[^/]+/api#', '/api', $path); // subcarpeta opcional
$path = preg_replace('#^/api.php#', '/api', $path);

if ($method === 'OPTIONS') { http_response_code(204); exit; }
$db = db_read();

if ($method === 'GET' && $path === '/api/health') respond(['ok'=>true,'service'=>'Pacific Bluffs PHP API']);
if ($method === 'GET' && $path === '/api/public') respond(sanitize_public($db));
if ($method === 'GET' && preg_match('#^/api/announcements/(.+)$#', $path, $m)) {
    $id = urldecode($m[1]);
    foreach (($db['announcements'] ?? []) as $a) if (($a['id'] ?? '') === $id && !empty($a['visible'])) respond($a);
    respond(['error'=>'Anuncio no encontrado'],404);
}
if ($method === 'POST' && $path === '/api/login') {
    $b = body_json(); $found = null;
    foreach ($db['users'] as $u) if (($u['username'] ?? '') === ($b['username'] ?? '')) { $found=$u; break; }
    if (!$found || !hash_equals((string)($found['passwordHash'] ?? ''), password_hash_pb((string)($b['password'] ?? ''), (string)($found['salt'] ?? '')))) respond(['error'=>'Usuario o contrasena incorrectos'],401);
    if (($found['active'] ?? true) === false) respond(['error'=>'Esta cuenta esta inactiva'],403);
    $token = bin2hex(random_bytes(30)); $sessions=sessions_read(); $sessions[$token]=['userId'=>$found['id'],'createdAt'=>time()]; sessions_write($sessions);
    respond(['token'=>$token,'user'=>without_secrets($found)]);
}
if ($method === 'POST' && $path === '/api/logout') {
    $t=bearer_token(); $s=sessions_read(); if($t) unset($s[$t]); sessions_write($s); respond(['ok'=>true]);
}
if ($method === 'POST' && $path === '/api/orders') {
    $b=body_json(); if(empty($b['businessName'])||empty($b['details'])) respond(['error'=>'Faltan el negocio y el detalle del encargo'],400);
    $fresh=db_read(); $order=['id'=>uuidv4(),'code'=>next_order_code($fresh),'businessName'=>substr((string)$b['businessName'],0,80),'contact'=>substr((string)($b['contact']??''),0,80),'details'=>substr((string)$b['details'],0,1200),'status'=>'recibido','note'=>'Encargo recibido. El equipo lo revisara pronto.','createdAt'=>now_iso(),'updatedAt'=>now_iso()];
    array_unshift($fresh['orders'],$order); db_write($fresh); respond($order,201);
}
if ($method === 'GET' && preg_match('#^/api/orders/(.+)$#',$path,$m)) {
    $code=strtoupper(urldecode($m[1])); foreach(($db['orders']??[]) as $o) if(strtoupper((string)($o['code']??''))===$code) respond($o); respond(['error'=>'No encontramos ese encargo'],404);
}

$auth=auth_user($db); if(!$auth) respond(['error'=>'Sesion requerida'],401); $user=$auth['user'];
if ($method === 'GET' && $path === '/api/dashboard') { $copy=$db; $copy['users']=array_map('without_secrets',$copy['users']); respond(['user'=>without_secrets($user),'data'=>$copy]); }
if (!can_manage($user)) respond(['error'=>'Tu rol solo permite ver el contenido'],403);
$b=$method==='GET'?[]:body_json();

if ($method==='PUT' && $path==='/api/business') { $db['business']=array_merge($db['business']??[],$b,['updatedAt'=>now_iso()]); db_write($db); respond($db['business']); }
if ($method==='POST' && $path==='/api/announcements') {
    $content=trim((string)($b['content']??$b['text']??'')); if(trim((string)($b['title']??''))===''||$content==='') respond(['error'=>'Faltan titulo y contenido del anuncio'],400);
    $images=[]; foreach(($b['images']??[]) as $im){ if(is_array($im)) $images[]=['id'=>(string)($im['id']??uuidv4()),'name'=>substr((string)($im['name']??'Imagen'),0,100),'src'=>(string)($im['src']??''),'isCover'=>!empty($im['isCover'])]; }
    $cover=(string)($b['coverImage']??''); if($cover==='' && $images) foreach($images as $im) if(!empty($im['isCover'])){$cover=$im['src'];break;}
    $item=['id'=>$b['id']??null,'title'=>substr((string)$b['title'],0,120),'summary'=>substr((string)($b['summary']??''),0,260),'text'=>substr((string)($b['summary']??$b['text']??''),0,1000),'content'=>substr($content,0,12000),'category'=>substr((string)($b['category']??'Comunicado'),0,60),'author'=>substr((string)($b['author']??$user['name']??'Pacific Bluffs'),0,80),'status'=>substr((string)($b['status']??'publicado'),0,30),'visible'=>!empty($b['visible']) && (string)($b['status']??'publicado')!=='borrador','featured'=>substr((string)($b['featured']??''),0,260),'coverImage'=>$cover,'images'=>$images,'createdAt'=>$b['createdAt']??now_iso(),'updatedAt'=>now_iso()];
    $out=upsert($db['announcements'],$item); db_write($db); respond($out);
}
if ($method==='DELETE' && preg_match('#^/api/announcements/(.+)$#',$path,$m)) { $id=urldecode($m[1]); $db['announcements']=array_values(array_filter($db['announcements'],fn($x)=>($x['id']??'')!==$id)); db_write($db); respond(['ok'=>true]); }
if ($method==='POST' && $path==='/api/menu') { $out=upsert($db['menuItems'],['id'=>$b['id']??null,'name'=>substr((string)($b['name']??''),0,100),'category'=>substr((string)($b['category']??'Carta'),0,60),'price'=>(float)($b['price']??0),'description'=>substr((string)($b['description']??''),0,600),'available'=>!empty($b['available'])]); db_write($db); respond($out); }
if ($method==='DELETE' && preg_match('#^/api/menu/(.+)$#',$path,$m)) { $id=urldecode($m[1]); $db['menuItems']=array_values(array_filter($db['menuItems'],fn($x)=>($x['id']??'')!==$id)); db_write($db); respond(['ok'=>true]); }
if ($method==='POST' && $path==='/api/order-status') { foreach($db['orders'] as &$o) if(($o['id']??'')===($b['id']??'')){ $o['status']=(string)($b['status']??$o['status']);$o['note']=substr((string)($b['note']??''),0,600);$o['updatedAt']=now_iso();db_write($db);respond($o);} respond(['error'=>'Encargo no encontrado'],404); }
if ($method==='DELETE' && preg_match('#^/api/orders/(.+)$#',$path,$m)) { $id=urldecode($m[1]);$before=count($db['orders']);$db['orders']=array_values(array_filter($db['orders'],fn($x)=>($x['id']??'')!==$id));if($before===count($db['orders']))respond(['error'=>'Encargo no encontrado'],404);db_write($db);respond(['ok'=>true]); }
if ($method==='POST' && $path==='/api/conventions') { $out=upsert($db['conventions'],['id'=>$b['id']??null,'name'=>substr((string)($b['name']??''),0,100),'discount'=>max(0,min(100,(float)($b['discount']??0))),'active'=>!empty($b['active']),'notes'=>substr((string)($b['notes']??''),0,600)]);db_write($db);respond($out); }
if ($method==='DELETE' && preg_match('#^/api/conventions/(.+)$#',$path,$m)){$id=urldecode($m[1]);$db['conventions']=array_values(array_filter($db['conventions'],fn($x)=>($x['id']??'')!==$id));db_write($db);respond(['ok'=>true]);}
if ($method==='POST' && $path==='/api/invoices'){$con=null;foreach(($db['conventions']??[]) as $c)if(($c['id']??'')===($b['conventionId']??'')){$con=$c;break;}$sub=(float)($b['subtotal']??0);$disc=$con?(float)$con['discount']:(float)($b['discount']??0);$inv=['id'=>uuidv4(),'businessName'=>substr((string)($b['businessName']??'Sin negocio'),0,100),'conventionName'=>$con?$con['name']:'Sin convenio','subtotal'=>$sub,'discount'=>$disc,'total'=>max(0,$sub-($sub*$disc/100)),'details'=>substr((string)($b['details']??''),0,1000),'createdBy'=>$user['name'],'createdAt'=>now_iso()];array_unshift($db['invoices'],$inv);db_write($db);respond($inv,201);}

if ($method==='POST' && $path==='/api/users') {
    if(!can_manage_users($user))respond(['error'=>'Solo el jefe puede crear usuarios'],403);$c=clean_user($b);
    if(!$c['username']||!$c['name']||empty($b['password'])||!$c['role'])respond(['error'=>'Faltan datos del usuario'],400);if(!valid_role($c['role']))respond(['error'=>'Rol no valido'],400);if($c['email']&&!filter_var($c['email'],FILTER_VALIDATE_EMAIL))respond(['error'=>'Correo electronico no valido'],400);if(strlen((string)$b['password'])<4)respond(['error'=>'La contrasena debe tener al menos 4 caracteres'],400);
    foreach($db['users'] as $u)if(strtolower($u['username'])===strtolower($c['username']))respond(['error'=>'Ese usuario ya existe'],409);
    $salt=bin2hex(random_bytes(12));$u=array_merge($c,['id'=>uuidv4(),'salt'=>$salt,'passwordHash'=>password_hash_pb((string)$b['password'],$salt),'createdAt'=>now_iso()]);$db['users'][]=$u;db_write($db);respond(without_secrets($u),201);
}
if ($method==='PUT' && preg_match('#^/api/users/(.+)$#',$path,$m)) {
    if(!can_manage_users($user))respond(['error'=>'Solo el jefe puede modificar usuarios'],403);$id=urldecode($m[1]);$idx=null;foreach($db['users'] as $i=>$u)if(($u['id']??'')===$id){$idx=$i;break;}if($idx===null)respond(['error'=>'Usuario no encontrado'],404);$c=clean_user($b);if(!$c['username']||!$c['name']||!$c['role'])respond(['error'=>'Faltan datos del usuario'],400);if(!valid_role($c['role']))respond(['error'=>'Rol no valido'],400);if($c['email']&&!filter_var($c['email'],FILTER_VALIDATE_EMAIL))respond(['error'=>'Correo electronico no valido'],400);foreach($db['users'] as $u)if(($u['id']??'')!==$id&&strtolower($u['username'])===strtolower($c['username']))respond(['error'=>'Ese usuario ya existe'],409);if($id===$user['id']&&($c['role']!=='jefe'||!$c['active']))respond(['error'=>'No puedes quitarte permisos de jefe ni desactivar tu propia cuenta'],400);
    $db['users'][$idx]=array_merge($db['users'][$idx],$c,['updatedAt'=>now_iso()]);if(!empty($b['password'])){if(strlen((string)$b['password'])<4)respond(['error'=>'La nueva contrasena debe tener al menos 4 caracteres'],400);$salt=bin2hex(random_bytes(12));$db['users'][$idx]['salt']=$salt;$db['users'][$idx]['passwordHash']=password_hash_pb((string)$b['password'],$salt);}db_write($db);respond(without_secrets($db['users'][$idx]));
}
if ($method==='DELETE' && preg_match('#^/api/users/(.+)$#',$path,$m)) {
    if(!can_manage_users($user))respond(['error'=>'Solo el jefe puede eliminar usuarios'],403);$id=urldecode($m[1]);if($id===$user['id'])respond(['error'=>'No puedes eliminar tu propia cuenta de jefe'],400);$target=null;foreach($db['users'] as $u)if(($u['id']??'')===$id){$target=$u;break;}if(!$target)respond(['error'=>'Usuario no encontrado'],404);$chiefs=0;foreach($db['users'] as $u)if(($u['role']??'')==='jefe'&&!empty($u['active'])&&($u['id']??'')!==$id)$chiefs++;if(($target['role']??'')==='jefe'&&$chiefs===0)respond(['error'=>'Debe quedar al menos un jefe activo'],400);$db['users']=array_values(array_filter($db['users'],fn($x)=>($x['id']??'')!==$id));$s=sessions_read();foreach($s as $tok=>$sess)if(($sess['userId']??'')===$id)unset($s[$tok]);sessions_write($s);db_write($db);respond(['ok'=>true]);
}
respond(['error'=>'Ruta API no encontrada'],404);
