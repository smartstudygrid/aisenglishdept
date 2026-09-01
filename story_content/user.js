function ExecuteScript(strId)
{
  switch (strId)
  {
      case "5jD7fy9QkTD":
        Script1();
        break;
      case "620Pxrhjy5N":
        Script2();
        break;
      case "6SzywIKo6mA":
        Script3();
        break;
  }
}

function Script1()
{
  var player = GetPlayer();

// Read existing count from localStorage
var visits = localStorage.getItem('ais_dashboard_visits');

if (!visits) {
    visits = 1;
} else {
    visits = parseInt(visits) + 1;
}

// Store updated value back to localStorage
localStorage.setItem('ais_dashboard_visits', visits);

// Update Storyline variable
player.SetVar("VisitCount", visits);
}

function Script2()
{
  var elem = document.documentElement;

if (!document.fullscreenElement && !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
  // Enter Fullscreen
  if (elem.requestFullscreen) {
    elem.requestFullscreen();
  } else if (elem.msRequestFullscreen) {
    elem.msRequestFullscreen();
  } else if (elem.mozRequestFullScreen) {
    elem.mozRequestFullScreen();
  } else if (elem.webkitRequestFullscreen) {
    elem.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
  }
} else {
  // Exit Fullscreen
  if (document.exitFullscreen) {
    document.exitFullscreen();
  } else if (document.msExitFullscreen) {
    document.msExitFullscreen();
  } else if (document.mozCancelFullScreen) {
    document.mozCancelFullScreen();
  } else if (document.webkitExitFullscreen) {
    document.webkitExitFullscreen();
  }
}
}

function Script3()
{
  var inputs = document.querySelectorAll('input');
for (var i = 0; i < inputs.length; i++) {
    inputs[i].type = 'password';
}
}

