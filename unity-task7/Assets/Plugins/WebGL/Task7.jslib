mergeInto(LibraryManager.library, {
  Task7State: function (json) {
    window.task7State = JSON.parse(UTF8ToString(json));
  },
  Task7Report: function (status, percent) {
    if (window.task7UI) window.task7UI.report(UTF8ToString(status), percent);
  }
});
