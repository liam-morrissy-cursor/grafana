import { css } from '@emotion/css';
import { useState } from 'react';
import { useCopyToClipboard } from 'react-use';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { CodeEditor, Field, IconButton, useStyles2 } from '@grafana/ui';

import { formatSQL } from '../../utils/formatSQL';

type PreviewProps = {
  rawSql: string;
  datasourceType?: string;
};

const COLLAPSED_HEIGHT = 80;
const EXPANDED_HEIGHT = 240;

export function Preview({ rawSql, datasourceType }: PreviewProps) {
  // TODO: use zero index to give feedback about copy success
  const [_, copyToClipboard] = useCopyToClipboard();
  const [isExpanded, setIsExpanded] = useState(false);
  const styles = useStyles2(getStyles);

  const copyPreview = (rawSql: string) => {
    copyToClipboard(rawSql);
    reportInteraction('grafana_sql_preview_copied', {
      datasource: datasourceType,
    });
  };

  const labelElement = (
    <div className={styles.labelWrapper}>
      <span className={styles.label}>
        <Trans i18nKey="grafana-sql.components.preview.label-element.preview">Preview</Trans>
      </span>
      <div className={styles.actions}>
        <IconButton
          tooltip={t('grafana-sql.components.preview.label-element.tooltip-copy-to-clipboard', 'Copy to clipboard')}
          onClick={() => copyPreview(rawSql)}
          name="copy"
        />
        <IconButton
          tooltip={
            isExpanded
              ? t('grafana-sql.components.preview.label-element.tooltip-collapse-preview', 'Collapse preview')
              : t('grafana-sql.components.preview.label-element.tooltip-expand-preview', 'Expand preview')
          }
          onClick={() => setIsExpanded(!isExpanded)}
          name={isExpanded ? 'angle-up' : 'angle-down'}
          aria-expanded={isExpanded}
          data-testid={selectors.components.SQLQueryEditor.previewToggleExpand}
        />
      </div>
    </div>
  );

  return (
    <Field label={labelElement} className={styles.grow}>
      <CodeEditor
        language="sql"
        height={isExpanded ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT}
        value={formatSQL(rawSql)}
        monacoOptions={{ scrollbar: { vertical: isExpanded ? 'auto' : 'hidden' }, scrollBeyondLastLine: false }}
        readOnly={true}
        showMiniMap={false}
      />
    </Field>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    grow: css({ flexGrow: 1 }),
    label: css({ fontSize: 12, fontWeight: theme.typography.fontWeightMedium }),
    labelWrapper: css({ display: 'flex', justifyContent: 'space-between', paddingBottom: theme.spacing(0.5) }),
    actions: css({ display: 'flex', alignItems: 'center', gap: theme.spacing(0.5) }),
  };
}
