export { testApiConsistencyAcrossLayers } from './apiConsistencyTests';
export { testActiveTabManagementFunctionality } from './activeTabManagementFunctionality';
export { testAriaSnapshotFunctionality } from './ariaSnapshotFunctionality';
export { testCheckFunctionality } from './checkFunctionality';
export { testClearFunctionality } from './clearFunctionality';
export { testClickFunctionality } from './clickFunctionality';
export { testCloseCurrentTabFunctionality } from './closeCurrentTabFunctionality';
export { testDblclickFunctionality } from './dblclickFunctionality';
export { demoSelectTextFunctionality } from './demoSelectText';
export { demoSetCheckedFunctionality } from './demoSetChecked';
export { testDispatchEventFunctionality } from './dispatchEventFunctionality';
export { testDownloadFunctionality } from './downloadFunctionality';
export { testDragToFunctionality, testDragToAdvanced } from './dragToFunctionality';
export { testEvaluateFunctionality } from './evaluateFunctionality';
export { testFillFunctionality } from './fillFunctionality';
export { testFrameMissingMethodsFunctionality } from './frameMissingMethodsFunctionality';
export { testGenericElementOperationsFunctionality } from './genericElementOperationsFunctionality';
export { testHighlightFunctionality } from './highlightFunctionality';
export { testLocatorFunctionality } from './locatorFunctionality';
export { testMissingMethodsFunctionality } from './missingMethodsFunctionality';
export { testPageMissingMethodsFunctionality } from './pageMissingMethodsFunctionality';
export { testPlaywrightCompatibility } from './playwrightCompatibilityTest';
export { testScreenshotterFunctionality } from './screenshotterFunctionality';
export { testScrollIntoViewIfNeededFunctionality } from './scrollIntoViewIfNeededFunctionality';
export { testSelectOptionFunctionality } from './selectOptionFunctionality';
export { testSetInputFilesFunctionality } from './setInputFilesFunctionality';
export { testSelectTextFunctionality } from './selectTextFunctionality';
export { testSelectTextWithExistingElements } from './selectTextWithExistingElements';
export { testSetCheckedFunctionality } from './setCheckedFunctionality';
export { testTapFunctionality } from './tapFunctionality';
export { testTextContentFunctionality } from './textContentFunctionality';
export { testTypeFunctionality } from './typeFunctionality';
export { testWaitForFunctionality } from './waitForFunctionality';
export { testWaitForEventFunctionality } from './waitForEventFunctionality';
export { testWaitForLoadStateFunctionality } from './waitForLoadStateFunctionality';
export { networkEventFunctionality as testNetworkEventFunctionality } from './networkEventFunctionality';
export { debugNetworkEvents } from './debugNetworkEventsWithSnapshots';
export { testCompareEventSubscriptions } from './compareEventSubscriptions';
export { testPageListenersFix } from './testPageListenersFix';
export {
  testNavigationAutoWait,
  testNavigationGoBack,
  testNavigationGoForward,
  testNavigationSameDocumentGoBack,
  testNavigationReload,
} from './navigationFunctionality';
export * from './testUtils';
