<?php
require('fpdf/fpdf.php');

$jso=stripslashes($_POST['json']);
$output=json_decode($jso);
$outlin=$output->lines;
$fntsiz=$output->fontSize;
$pagsiz=$output->pageSize;
$filnam=$output->fileName;
$pdf = new FPDF('P', 'pt', $pagsiz);
$pdf->SetAutoPageBreak(false);
$pdf->AddPage();
$pdf->AddFont('LiberationSerifBold','','LiberationSerif-Bold.php');
$pdf->AddFont('LiberationSerif','','LiberationSerif-Regular.php');
$pdf->AddFont('LiberationMono','','LiberationMono-Regular.php');
$pdf->SetFont('LiberationSerifBold','',15);

$lx=$output->x1;
$first=true;

foreach ($outlin as &$lin) {
	if($output->twoColumn && $lin->c==2) {
		$lx=$output->x2;
		}

	$pdf->SetXY($lx, $lin->y);
	$pdf->Cell(200, 10, $lin->tx);

	if($first) {
		$first=false;
		$pdf->SetFont('LiberationMono','',$fntsiz);
		}
	}

$leglft=504;//legend position
$legtop=730;
if($pagsiz=="A4") {
	$leglft=487;
	$legtop=780;
	}

$pdf->SetFont('LiberationSerif','',10);
$pdf->SetXY($leglft,$legtop);
$pdf->Cell(200,10,'One Page Chords');

$pdf->Output($filnam,'I');
?>