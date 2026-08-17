import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
import { useCopyToClipboard } from 'react-use';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { CodeEditor, Field, IconButton, useStyles2 } from '@grafana/ui';

import { formatSQL } from '../../utils/formatSQL';

type PreviewProps = {
  rawSql: string;
  datasourceType?: string;
};

const SHOW_SUCCESS_DURATION = 2 * 1000;

export function Preview({ rawSql, datasourceType }: PreviewProps) {
  const [copyState, copyToClipboard] = useCopyToClipboard();
  const [showCopySuccess, setShowCopySuccess] = useState(false);
  const styles = useStyles2(getStyles);

  // copyState is a fresh object on every copy, so copying twice restarts the timeout below.
  // noUserInteraction is false when the clipboard write fell back to a manual copy prompt,
  // which is the only way to tell a real write apart from a failed one.
  useEffect(() => {
    const { value, error, noUserInteraction } = copyState;

    if (!value || error || !noUserInteraction) {
      return;
    }

    setShowCopySuccess(true);
    const timeoutId = setTimeout(() => setShowCopySuccess(false), SHOW_SUCCESS_DURATION);

    return () => clearTimeout(timeoutId);
  }, [copyState]);

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
      <IconButton
        tooltip={
          showCopySuccess
            ? t('grafana-sql.components.preview.label-element.tooltip-copied', 'Copied')
            : t('grafana-sql.components.preview.label-element.tooltip-copy-to-clipboard', 'Copy to clipboard')
        }
        onClick={() => copyPreview(rawSql)}
        name={showCopySuccess ? 'check' : 'copy'}
      />
    </div>
  );

  return (
    <Field label={labelElement} className={styles.grow}>
      <CodeEditor
        language="sql"
        height={80}
        value={formatSQL(rawSql)}
        monacoOptions={{ scrollbar: { vertical: 'hidden' }, scrollBeyondLastLine: false }}
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
  };
}
