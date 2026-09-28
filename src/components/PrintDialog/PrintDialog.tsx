import { useMemo } from 'react'
import { Callout, Field, NumberField, PrintDialog as KitPrintDialog, Segmented, Switch } from '@tomkail/workshop-kit'
import { usePrintStore } from '../../stores/printStore'
import { useDocumentStore } from '../../stores/documentStore'
import { buildPrintContent, buildPrintPages, downloadDrawingSvg } from '../../utils/print'
import styles from './PrintDialog.module.css'

const mmFormat = (v: number) => String(Math.round(v * 10) / 10)

export function PrintDialog() {
  const settings = usePrintStore((s) => s.settings)
  const update = usePrintStore((s) => s.update)
  const close = usePrintStore((s) => s.close)
  // Subscribe to the document so the preview follows edits (undo etc.)
  const doc = useDocumentStore()

  const content = useMemo(() => buildPrintContent(settings), [settings, doc])
  const pages = useMemo(() => (content ? buildPrintPages(content, settings) : []), [content, settings])

  if (!content || pages.length === 0) {
    return null
  }

  const physical = settings.scaleMode === 'physical'
  const { width, height } = content.bounds
  const fileName = content.name.replace(/[^a-z0-9]+/gi, '_')

  return (
    <KitPrintDialog
      title="Print"
      pages={pages}
      options={settings}
      onChange={update}
      onClose={close}
      filename={fileName}
      documentTitle={content.name}
      physical={physical}
      onDownloadSvg={() => downloadDrawingSvg(content, settings)}
      notices={
        !physical && (
          <Callout>
            Canvas units aren’t tied to a real size. Choose <strong>True size</strong> to print at a scale you set, e.g. a 510 mm guitar body across several sheets.
          </Callout>
        )
      }
    >
      <Field label="Scale">
        <Segmented
          value={settings.scaleMode}
          onChange={(scaleMode) => update({ scaleMode })}
          options={[
            { value: 'fit', label: 'Fit to page' },
            { value: 'physical', label: 'True size' },
          ]}
        />
      </Field>
      {physical && (
        <>
          <Field label="1 unit =" htmlFor="mm-per-unit">
            <NumberField id="mm-per-unit" value={settings.mmPerUnit} onChange={(mmPerUnit) => update({ mmPerUnit })} min={0.001} max={1000} step={0.1} suffix="mm" format={(v) => String(Math.round(v * 10000) / 10000)} />
          </Field>
          <Field label="Width" htmlFor="print-width" hint="Or set the size you want and the scale follows">
            <div className={styles.sizeRow}>
              <NumberField id="print-width" value={width * settings.mmPerUnit} onChange={(w) => update({ mmPerUnit: w / width })} min={1} step={1} suffix="mm" format={mmFormat} />
              <span className={styles.times}>×</span>
              <NumberField id="print-height" value={height * settings.mmPerUnit} onChange={(h) => update({ mmPerUnit: h / height })} min={1} step={1} suffix="mm" format={mmFormat} />
            </div>
          </Field>
        </>
      )}
      <Field label="Line width" htmlFor="stroke-width">
        <NumberField id="stroke-width" value={settings.strokeWidth} onChange={(strokeWidth) => update({ strokeWidth })} min={0.05} max={5} step={0.05} suffix="mm" format={(v) => String(Math.round(v * 100) / 100)} />
      </Field>
      <Switch checked={settings.showCircles} onChange={(showCircles) => update({ showCircles })} label="Show circles" />
      <Switch checked={settings.fill} onChange={(fill) => update({ fill })} label="Shade inside (closed paths)" />
    </KitPrintDialog>
  )
}
