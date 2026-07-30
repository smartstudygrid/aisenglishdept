function ExecuteScript(strId)
{
  switch (strId)
  {
      case "5xtLbkULtfr":
        Script1();
        break;
  }
}

function Script1()
{
  var inputs = document.querySelectorAll('input');
for (var i = 0; i < inputs.length; i++) {
    inputs[i].type = 'password';
}
}

