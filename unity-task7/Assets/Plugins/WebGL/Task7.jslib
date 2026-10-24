mergeInto(LibraryManager.library, {
  Task7Report: function (status, percent) {
    if (window.task7UI) window.task7UI.report(UTF8ToString(status), percent);
  }
});
